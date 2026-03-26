# Calorie Tracker

A personal nutrition tracking web app built with Angular and Firebase.

**[Live Demo](https://ccurrie16.github.io/calorie-tracker/)**

![Daily progress and weekly summary](public/Screenshot%201.png)
![Meal logging and nutrient breakdown](public/Screenshot%202.png)

## Features

- **Daily calorie tracking** with an adjustable calorie goal
- **Full nutrient tracking** — calories, protein, carbs, fat, fiber, sugar, sodium, and saturated fat
- **Food database search** powered by the USDA FoodData Central API — search any food and auto-fill all nutrient fields
- **Meal favorites** — save frequently eaten meals and re-log them with one click
- **Weekly summary** — bar chart showing your calorie intake across the past 7 days
- **Date navigation** — browse and log meals for any past day
- **Color-coded nutrient bars** on both the daily summary and individual meal cards
- **Google authentication** via Firebase Auth

## Tech Stack

- [Angular 21](https://angular.dev) with SSR
- [Firebase](https://firebase.google.com) — Firestore (database) + Auth
- [USDA FoodData Central API](https://fdc.nal.usda.gov) — food search
