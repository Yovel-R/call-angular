import { Routes } from '@angular/router';
import { ShellRoutePlaceholderComponent } from './shell-route-placeholder.component';

export type AdminPageId =
  | 'overview'
  | 'leads'
  | 'followups'
  | 'employees'
  | 'reports'
  | 'company'
  | 'support'
  | 'emp_dashboard'
  | 'settings'
  | 'invoice'
  | 'invoice_settings'
  | 'quotation'
  | 'remarks_filter';

export const ADMIN_PAGES: readonly AdminPageId[] = [
  'overview',
  'leads',
  'followups',
  'employees',
  'reports',
  'company',
  'support',
  'emp_dashboard',
  'settings',
  'invoice_settings',
  'remarks_filter',
];

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...ADMIN_PAGES.map((page) => ({ path: page, component: ShellRoutePlaceholderComponent, data: { page } })),
  { path: '**', redirectTo: 'overview' },
];
