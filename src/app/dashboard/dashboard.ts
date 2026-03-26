import { Component, OnInit, OnDestroy, HostListener, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDoc, setDoc, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AuthService } from '../auth/auth';
import { inject } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { from } from 'rxjs';

interface FoodResult {
  id: string;
  name: string;
  calories100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  servingSize: number | null;
}

interface Meal {
  id?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  userId: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  meals: Meal[] = [];
  editingMeal: Meal | null = null;
  dailyGoal = 2000;
  editingGoal = false;
  goalInput = 2000;
  selectedDate = new Date().toISOString().split('T')[0];
  private mealsUnsubscribe: Unsubscribe | null = null;

  searchQuery = '';
  searchResults: FoodResult[] = [];
  isSearching = false;
  showResults = false;
  private searchSubject = new Subject<string>();
  private searchSubscription: any;

  newMeal: Meal = {
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    date: this.selectedDate,
    userId: ''
  };

  ngOnInit() {
    this.loadGoal();
    this.loadMeals();
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query.trim()) {
          this.searchResults = [];
          this.isSearching = false;
          return from([[]]);
        }
        this.isSearching = true;
        return from(this.fetchFoods(query));
      })
    ).subscribe(results => {
      this.ngZone.run(() => {
        this.searchResults = results as FoodResult[];
        this.isSearching = false;
        this.showResults = this.searchResults.length > 0;
      });
    });
  }

  ngOnDestroy() {
    this.mealsUnsubscribe?.();
    this.searchSubscription?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-wrapper')) {
      this.showResults = false;
    }
  }

  onSearchInput() {
    this.searchSubject.next(this.searchQuery);
    if (this.searchQuery.trim()) {
      this.isSearching = true;
    } else {
      this.searchResults = [];
      this.showResults = false;
      this.isSearching = false;
    }
  }

  private async fetchFoods(query: string): Promise<FoodResult[]> {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=7&api_key=DEMO_KEY`;
    const response = await fetch(url);
    const data = await response.json();
    return (data.foods || [])
      .map((f: any) => {
        const nutrients = f.foodNutrients ?? [];
        const get = (name: string) => nutrients.find((n: any) => n.nutrientName === name)?.value ?? 0;
        const calories = Math.round(get('Energy'));
        if (!calories) return null;
        return {
          id: f.fdcId,
          name: f.description,
          calories100g: calories,
          protein100g: Math.round(get('Protein') * 10) / 10,
          carbs100g: Math.round(get('Carbohydrate, by difference') * 10) / 10,
          fat100g: Math.round(get('Total lipid (fat)') * 10) / 10,
          servingSize: f.servingSize && f.servingSizeUnit?.toLowerCase() === 'g' ? Math.round(f.servingSize) : null,
        } as FoodResult;
      })
      .filter(Boolean);
  }

  selectFood(food: FoodResult) {
    const serving = food.servingSize ?? 100;
    const factor = serving / 100;
    this.newMeal.name = food.name;
    this.newMeal.calories = Math.round(food.calories100g * factor);
    this.newMeal.protein = Math.round(food.protein100g * factor * 10) / 10;
    this.newMeal.carbs = Math.round(food.carbs100g * factor * 10) / 10;
    this.newMeal.fat = Math.round(food.fat100g * factor * 10) / 10;
    this.searchQuery = '';
    this.searchResults = [];
    this.showResults = false;
  }

  get isToday() {
    return this.selectedDate === new Date().toISOString().split('T')[0];
  }

  changeDate(offset: number) {
    const date = new Date(this.selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + offset);
    const newDate = date.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    if (newDate > today) return;
    this.selectedDate = newDate;
    this.newMeal.date = this.selectedDate;
    this.editingMeal = null;
    this.loadMeals();
  }

  goToToday() {
    this.selectedDate = new Date().toISOString().split('T')[0];
    this.newMeal.date = this.selectedDate;
    this.editingMeal = null;
    this.loadMeals();
  }

  private async loadGoal() {
    const user = auth.currentUser;
    if (!user) return;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && userDoc.data()['dailyGoal']) {
      this.dailyGoal = userDoc.data()['dailyGoal'];
      this.goalInput = this.dailyGoal;
    }
  }

  startEditGoal() {
    this.goalInput = this.dailyGoal;
    this.editingGoal = true;
  }

  cancelEditGoal() {
    this.editingGoal = false;
  }

  async saveGoal() {
    const user = auth.currentUser;
    if (!user || !this.goalInput || this.goalInput <= 0) return;
    await setDoc(doc(db, 'users', user.uid), { dailyGoal: this.goalInput }, { merge: true });
    this.dailyGoal = this.goalInput;
    this.editingGoal = false;
  }

  private loadMeals() {
    this.mealsUnsubscribe?.();
    const user = auth.currentUser;
    if (!user) return;

    const mealsRef = collection(db, 'meals');
    const mealsQuery = query(
      mealsRef,
      where('userId', '==', user.uid),
      where('date', '==', this.selectedDate)
    );
    this.mealsUnsubscribe = onSnapshot(mealsQuery, snapshot => {
      this.meals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal));
    });
  }

  get totalCalories() {
    return this.meals.reduce((sum, meal) => sum + meal.calories, 0);
  }

  get totalProtein() {
    return this.meals.reduce((sum, meal) => sum + meal.protein, 0);
  }

  get totalCarbs() {
    return this.meals.reduce((sum, meal) => sum + meal.carbs, 0);
  }

  get totalFat() {
    return this.meals.reduce((sum, meal) => sum + meal.fat, 0);
  }

  get calorieProgress() {
    return Math.min((this.totalCalories / this.dailyGoal) * 100, 100);
  }

  async addMeal() {
    const user = auth.currentUser;
    if (!user || !this.newMeal.name || !this.newMeal.calories) return;

    const mealsRef = collection(db, 'meals');
    await addDoc(mealsRef, { ...this.newMeal, userId: user.uid });

    this.newMeal = {
      name: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      date: this.selectedDate,
      userId: ''
    };
  }

  startEdit(meal: Meal) {
    this.editingMeal = { ...meal };
  }

  cancelEdit() {
    this.editingMeal = null;
  }

  async saveEdit() {
    if (!this.editingMeal?.id) return;
    const mealRef = doc(db, 'meals', this.editingMeal.id);
    const { id, ...data } = this.editingMeal;
    await updateDoc(mealRef, data);
    this.editingMeal = null;
  }

  async deleteMeal(meal: Meal) {
    if (!meal.id) return;
    await deleteDoc(doc(db, 'meals', meal.id));
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}