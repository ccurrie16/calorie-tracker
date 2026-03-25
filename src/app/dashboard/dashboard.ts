import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AuthService } from '../auth/auth';
import { inject } from '@angular/core';

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
export class Dashboard implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  meals: Meal[] = [];
  dailyGoal = 2000;
  today = new Date().toISOString().split('T')[0];

  newMeal: Meal = {
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    date: this.today,
    userId: ''
  };

  ngOnInit() {
    const user = auth.currentUser;
    if (!user) return;

    const mealsRef = collection(db, 'meals');
    const mealsQuery = query(
      mealsRef,
      where('userId', '==', user.uid),
      where('date', '==', this.today)
    );
    onSnapshot(mealsQuery, snapshot => {
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
      date: this.today,
      userId: ''
    };
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}