import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { LeadService } from '../../../services/lead.service';
import { LeadCompany, Lead } from '../domain/lead.model';
import { LeadListDto, LeadListQueryDto } from './lead.dto';
import { mapLeadListDto } from './lead.mapper';

export interface LeadPage {
  items: Lead[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  sets: string[];
  companies: LeadCompany[];
}

@Injectable({ providedIn: 'root' })
export class AdminLeadsRepository {
  constructor(private leadService: LeadService) {}

  list(companyCode: string, query: LeadListQueryDto): Observable<LeadPage> {
    return this.leadService
      .getAdminLeadPage(companyCode, query)
      .pipe(map((response) => mapLeadListDto(response as LeadListDto)));
  }

  listCompanies(companyCode: string, query: LeadListQueryDto): Observable<LeadCompany[]> {
    return this.leadService.getAdminLeadCompanies(companyCode, query).pipe(
      map((response: any) => response?.companies || [])
    );
  }

  updateStatus(leadId: string, status: string): Observable<Lead> {
    return this.leadService
      .updateLeadStatus(leadId, status)
      .pipe(map((response: any) => mapLeadListDto({ success: true, items: [response.lead] }).items[0]));
  }
}
