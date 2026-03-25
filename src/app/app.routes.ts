import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login';
import { Dashboard } from './dashboard/dashboard';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
];