import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../../admin-workspace/admin-workspace.component';

@Component({
  selector: 'app-crm-admin-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './crm-admin-section.component.html'
})
export class CrmAdminSectionComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}
