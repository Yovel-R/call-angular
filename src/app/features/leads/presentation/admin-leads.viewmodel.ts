import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { OPERATIONAL_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../../../core/config/pagination.config';
import { Lead, LeadCompany } from '../domain/lead.model';
import { AdminLeadsRepository } from '../data/admin-leads.repository';
import { LeadListQueryDto } from '../data/lead.dto';

export interface AdminLeadsState {
  companies: LeadCompany[];
  leads: Lead[];
  selectedCompany: string;
  search: string;
  status: string;
  setLabel: string;
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  empty: boolean;
  error: string;
}

const initialState: AdminLeadsState = {
  companies: [],
  leads: [],
  selectedCompany: '',
  search: '',
  status: '',
  setLabel: '',
  page: 1,
  hasMore: false,
  loading: false,
  loadingMore: false,
  empty: false,
  error: '',
};

@Injectable({ providedIn: 'root' })
export class AdminLeadsViewModel {
  private readonly stateSubject = new BehaviorSubject<AdminLeadsState>(initialState);
  readonly state$ = this.stateSubject.asObservable();
  private readonly searchSubject = new Subject<string>();
  private companyCode = '';
  private requestRun = 0;

  constructor(private repository: AdminLeadsRepository) {
    this.searchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
      tap((search) => this.patch({ search })),
      switchMap(() => this.reloadCompaniesAndLeads())
    ).subscribe();
  }

  init(companyCode: string): void {
    this.companyCode = companyCode;
    this.reloadCompaniesAndLeads().subscribe();
  }

  setSearch(search: string): void {
    this.searchSubject.next(search.trim());
  }

  setFilter(filter: Pick<AdminLeadsState, 'status' | 'setLabel'>): void {
    this.patch({ ...filter });
    this.reloadCompaniesAndLeads().subscribe();
  }

  selectCompany(name: string): void {
    this.patch({ selectedCompany: name, leads: [], page: 1, hasMore: false });
    this.loadLeads(false).subscribe();
  }

  loadNextCompanyPage(): void {
    const state = this.stateSubject.value;
    if (state.loadingMore || !state.hasMore) return;
    this.loadLeads(true).subscribe();
  }

  updateStatus(lead: Lead, status: string): void {
    if (!lead.id) return;
    this.repository.updateStatus(lead.id, status).subscribe({
      next: (updated) => {
        const leads = this.stateSubject.value.leads.map((item) => item.id === lead.id ? updated : item);
        this.patch({ leads });
      },
      error: () => this.patch({ error: 'Failed to update lead status.' }),
    });
  }

  private reloadCompaniesAndLeads() {
    this.patch({ loading: true, error: '', page: 1, leads: [], hasMore: false });
    const run = ++this.requestRun;
    return this.repository.listCompanies(this.companyCode, this.queryFor(1)).pipe(
      tap({
        next: (companies) => {
          if (run !== this.requestRun) return;
          const selectedCompany = companies[0]?.name || '';
          this.patch({ companies, selectedCompany });
          this.loadLeads(false, run).subscribe();
        },
        error: () => this.patch({ loading: false, error: 'Failed to load lead companies.' }),
      })
    );
  }

  private loadLeads(append: boolean, run = ++this.requestRun) {
    const state = this.stateSubject.value;
    const page = append ? state.page + 1 : 1;
    this.patch(append ? { loadingMore: true } : { loading: true, error: '' });

    return this.repository.list(this.companyCode, this.queryFor(page)).pipe(
      tap({
        next: (result) => {
          if (run !== this.requestRun) return;
          const leads = append ? [...this.stateSubject.value.leads, ...result.items] : result.items;
          this.patch({
            leads,
            page: result.page,
            hasMore: result.hasMore,
            loading: false,
            loadingMore: false,
            empty: !leads.length,
          });
        },
        error: () => this.patch({ loading: false, loadingMore: false, error: 'Failed to load leads.' }),
      })
    );
  }

  private queryFor(page: number): LeadListQueryDto {
    const state = this.stateSubject.value;
    return {
      page,
      pageSize: OPERATIONAL_PAGE_SIZE,
      paginated: true,
      includeFacets: page === 1,
      search: state.search,
      status: state.status,
      setLabel: state.setLabel,
      company: state.selectedCompany,
    } as LeadListQueryDto;
  }

  private patch(partial: Partial<AdminLeadsState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
