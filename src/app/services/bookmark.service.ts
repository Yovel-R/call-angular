import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Bookmark {
  _id?: string;
  companyCode: string;
  employeePhone: string;
  contactNumber: string;
  contactName: string;
  remarks: string[];
  brochuresSent?: boolean;
  techMeet?: boolean;
  meetingRemarks?: boolean;
  quotationSent?: boolean;
  proposalSent?: boolean;
  whatsappGrp?: boolean;
  callTimestamp?: number;
  reminderDate: string | null;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BookmarkService {
  private baseUrl: string;

  constructor(private http: HttpClient, private apiService: ApiService) {
    this.baseUrl = this.apiService.baseUrl + '/api/bookmarks';
  }

  getBookmarks(companyCode: string, phone: string): Observable<any> {
    return this.http.get(`${this.baseUrl}?companyCode=${companyCode}&phone=${phone}`);
  }

  // Admin view: fetch all bookmarks for the whole company
  getAllCompanyBookmarks(companyCode: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin?companyCode=${companyCode}`);
  }

  deleteBookmark(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  updateBookmark(id: string, payload: { description?: string, reminderDate?: string | null }): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}`, payload);
  }
}
