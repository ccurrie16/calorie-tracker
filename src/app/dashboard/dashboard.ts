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
  fiber100g: number;
  sugar100g: number;
  sodium100g: number;
  saturatedFat100g: number;
  servingSize: number | null;
}

interface Favorite {
  id?: string;
  userId: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  saturatedFat: number;
}

interface Meal {
  id?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  saturatedFat: number;
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

  favorites: Favorite[] = [];
  private favoritesUnsubscribe: Unsubscribe | null = null;

  weeklyData: { date: string; day: string; calories: number }[] = [];
  private weeklyUnsubscribe: Unsubscribe | null = null;

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
    fiber: 0,
    sugar: 0,
    sodium: 0,
    saturatedFat: 0,
    date: this.selectedDate,
    userId: ''
  };

  ngOnInit() {
    this.loadGoal();
    this.loadMeals();
    this.loadFavorites();
    this.loadWeeklyData();
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
    this.favoritesUnsubscribe?.();
    this.weeklyUnsubscribe?.();
    this.searchSubscription?.unsubscribe();
  }

  private loadWeeklyData() {
    const user = auth.currentUser;
    if (!user) return;

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d.toISOString().split('T')[0],
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        calories: 0,
      };
    });

    const startDate = days[0].date;
    const q = query(
      collection(db, 'meals'),
      where('userId', '==', user.uid),
      where('date', '>=', startDate)
    );

    this.weeklyUnsubscribe = onSnapshot(q, snapshot => {
      this.ngZone.run(() => {
        const totals: Record<string, number> = {};
        snapshot.docs.forEach(d => {
          const meal = d.data() as Meal;
          totals[meal.date] = (totals[meal.date] ?? 0) + meal.calories;
        });
        this.weeklyData = days.map(d => ({ ...d, calories: totals[d.date] ?? 0 }));
      });
    });
  }

  private loadFavorites() {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'favorites'), where('userId', '==', user.uid));
    this.favoritesUnsubscribe = onSnapshot(q, snapshot => {
      this.favorites = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Favorite));
    });
  }

  async saveFavorite(meal: Meal) {
    const user = auth.currentUser;
    if (!user) return;
    const { id, date, ...rest } = meal;
    await addDoc(collection(db, 'favorites'), { ...rest, userId: user.uid });
  }

  async deleteFavorite(fav: Favorite) {
    if (!fav.id) return;
    await deleteDoc(doc(db, 'favorites', fav.id));
  }

  logFavorite(fav: Favorite) {
    const { id, userId, ...rest } = fav;
    this.newMeal = { ...this.newMeal, ...rest };
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
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=7&api_key=2619od3ZCTqSXraxF7o4S4KSvdfDoAqrrd5Uy23y`;
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
          fiber100g: Math.round(get('Fiber, total dietary') * 10) / 10,
          sugar100g: Math.round(get('Sugars, total including NLEA') * 10) / 10,
          sodium100g: Math.round(get('Sodium, Na')),
          saturatedFat100g: Math.round(get('Fatty acids, total saturated') * 10) / 10,
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
    this.newMeal.fiber = Math.round(food.fiber100g * factor * 10) / 10;
    this.newMeal.sugar = Math.round(food.sugar100g * factor * 10) / 10;
    this.newMeal.sodium = Math.round(food.sodium100g * factor);
    this.newMeal.saturatedFat = Math.round(food.saturatedFat100g * factor * 10) / 10;
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

  get totalFiber() {
    return Math.round(this.meals.reduce((sum, meal) => sum + (meal.fiber ?? 0), 0) * 10) / 10;
  }

  get totalSugar() {
    return Math.round(this.meals.reduce((sum, meal) => sum + (meal.sugar ?? 0), 0) * 10) / 10;
  }

  get totalSodium() {
    return Math.round(this.meals.reduce((sum, meal) => sum + (meal.sodium ?? 0), 0));
  }

  get totalSaturatedFat() {
    return Math.round(this.meals.reduce((sum, meal) => sum + (meal.saturatedFat ?? 0), 0) * 10) / 10;
  }

  nutrientBar(value: number, max: number) {
    return Math.min((value / max) * 100, 100);
  }

  weeklyBarHeight(calories: number) {
    const max = Math.max(this.dailyGoal, ...this.weeklyData.map(d => d.calories));
    return Math.round((calories / max) * 100);
  }

  get proteinGoal() { return Math.round(this.dailyGoal * 0.25 / 4); }
  get carbsGoal()   { return Math.round(this.dailyGoal * 0.50 / 4); }
  get fatGoal()     { return Math.round(this.dailyGoal * 0.25 / 9); }

  get caloriesRemaining() { return this.dailyGoal - this.totalCalories; }

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
      fiber: 0,
      sugar: 0,
      sodium: 0,
      saturatedFat: 0,
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