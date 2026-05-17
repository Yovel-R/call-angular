import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { AdminWorkspaceComponent } from '../../admin-workspace.component';

@Component({
  selector: 'app-admin-dashboard-sidebar',
  imports: [CommonModule],
  templateUrl: './admin-dashboard-sidebar.component.html'
})
export class AdminDashboardSidebarComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}
