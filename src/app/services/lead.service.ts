import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Lead {
  _id?: string;
  companyCode: string;
  assignedEmployeePhone: string;
  leadCompanyName: string;
  contactName: string;
  contactNumber: string;
  status: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LeadService {
  constructor(private api: ApiService) {}

  addSingleLead(lead: Partial<Lead>): Observable<any> {
    return this.api.post('/api/leads', lead);
  }

  addBulkLeads(leads: Partial<Lead>[]): Observable<any> {
    return this.api.post('/api/leads/bulk', { leads });
  }

  getEmployeeLeads(companyCode: string, phone: string): Observable<any> {
    return this.api.get(`/api/leads/employee?companyCode=${encodeURIComponent(companyCode)}&phone=${encodeURIComponent(phone)}`);
  }

  getAdminLeads(companyCode: string): Observable<any> {
    return this.api.get(`/api/leads/admin?companyCode=${encodeURIComponent(companyCode)}`);
  }

  deleteLead(id: string): Observable<any> {
    return this.api.delete(`/api/leads/${id}`);
  }
}
