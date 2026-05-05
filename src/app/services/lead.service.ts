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
  setLabel?: string;
  companyDescription?: string;
  mainDivisionDescription?: string;
  directorEmailAddress?: string;
  remarks?: string[];
  isStarred?: boolean;
  isFavourite?: boolean;
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

  getEmployeeLeads(companyCode: string, phone: string, setLabel?: string): Observable<any> {
    let url = `/api/leads/employee?companyCode=${encodeURIComponent(companyCode)}&phone=${encodeURIComponent(phone)}`;
    if (setLabel) url += `&setLabel=${encodeURIComponent(setLabel)}`;
    return this.api.get(url);
  }

  getAdminLeads(companyCode: string, setLabel?: string): Observable<any> {
    let url = `/api/leads/admin?companyCode=${encodeURIComponent(companyCode)}`;
    if (setLabel) url += `&setLabel=${encodeURIComponent(setLabel)}`;
    return this.api.get(url);
  }

  deleteLead(id: string): Observable<any> {
    return this.api.delete(`/api/leads/${id}`);
  }

  deleteLeadSet(companyCode: string, phone: string, setLabel: string): Observable<any> {
    return this.api.post('/api/leads/set/delete', { companyCode, phone, setLabel });
  }

  deleteAdminLeadSet(companyCode: string, setLabel: string): Observable<any> {
    return this.api.post('/api/leads/admin/delete-set', { companyCode, setLabel });
  }

  updateLeadFlags(id: string, flags: { isStarred?: boolean; isFavourite?: boolean }): Observable<any> {
    return this.api.patch(`/api/leads/${id}/flags`, flags);
  }

  updateLeadStatus(id: string, status: string): Observable<any> {
    return this.api.patch(`/api/leads/${id}/status`, { status });
  }

  addLeadRemark(id: string, remark: string): Observable<any> {
    return this.api.post(`/api/leads/${id}/remarks`, { remark });
  }

  deleteLeadRemark(id: string, index: number): Observable<any> {
    return this.api.delete(`/api/leads/${id}/remarks/${index}`);
  }
}
