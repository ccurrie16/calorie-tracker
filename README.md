# Calorie Tracker

A personal nutrition tracking web app built with Angular and Firebase.

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

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore and Google Auth enabled
- A USDA FoodData Central API key (free at [fdc.nal.usda.gov](https://fdc.nal.usda.gov))

### Setup

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Update `src/app/firebase.ts` with your Firebase project config.

3. Replace the API key in `src/app/dashboard/dashboard.ts`:

```ts
api_key=YOUR_USDA_API_KEY
```

4. Set your Firestore security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /meals/{meal} {
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    match /favorites/{fav} {
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

5. Create a composite Firestore index on the `meals` collection for `userId (Ascending)` + `date (Ascending)`.

### Running locally

```bash
npm start
```

Then open `http://localhost:4200`.
