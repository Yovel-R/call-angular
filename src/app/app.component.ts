import { Component, OnInit, ViewEncapsulation, HostListener } from '@angular/core';
import { NgIf, NgFor, NgClass, SlicePipe, DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartType, registerables } from 'chart.js';
import { AuthService, RegisterPayload, LoginPayload } from './services/auth.service';
import { EmployeeService, Employee } from './services/employee.service';
import { CallLogService, CallStats } from './services/calllog.service';
import { PaymentService } from './services/payment.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-root',
  imports: [NgIf, NgFor, NgClass, FormsModule, SlicePipe, DecimalPipe, DatePipe, TitleCasePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit {
  title = 'web-page';
  isNavbarScrolled = false;

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isNavbarScrolled = window.scrollY > 20;
  }

  goHome() {
    if (this.loggedIn) {
      this.loggedIn = false;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Signup / Login ─────────────────────────────────────────
  signupForm: RegisterPayload = {
    companyName: '', companyAddress: '', name: '', email: '', password: '',
    countryCode: '+91', mobile: '', teamSize: '', industry: '',
  };
  signupError = '';
  signupSuccess = false;
  signupLoading = false;
  isTrialRequest = false;

  // ── Payment ────────────────────────────────────────────────
  paymentToDate = '';
  paymentCostPreview: { days: number; teamSizeMax: number; amountRupees: number } | null = null;
  paymentCostLoading = false;
  paymentStep: 'idle' | 'paying' | 'done' = 'idle';
  pendingCompanyCode = '';
  paymentHistory: any[] = [];
  paymentHistoryLoading = false;
  renewToDate = '';
  renewCostPreview: { days: number; teamSizeMax: number; amountRupees: number } | null = null;
  renewLoading = false;

  razorpayKeyId = '';

  get minToDate(): string {
    // Start from today (local)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let base = new Date(today);

    if (this.companyProfile?.subscriptionTo) {
      // Parse subscriptionTo in LOCAL time — avoid UTC off-by-one in IST
      const raw: string = this.companyProfile.subscriptionTo.substring(0, 10); // "YYYY-MM-DD"
      const [sY, sM, sD] = raw.split('-').map(Number);
      const subEnd = new Date(sY, sM - 1, sD, 23, 59, 59);
      if (subEnd > today) base = new Date(sY, sM - 1, sD); // keep as the sub-end day
    }

    // Minimum selectable = one day AFTER base (day after expiry, or tomorrow if expired)
    base.setDate(base.getDate() + 1);

    // Format as "YYYY-MM-DD" using LOCAL date parts (NOT toISOString which shifts to UTC)
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  get subscriptionExpired(): boolean {
    if (!this.companyProfile) return false;
    if (this.companyProfile.status === 'On due') return true;
    if (this.companyProfile.subscriptionTo) {
      return new Date(this.companyProfile.subscriptionTo) < new Date();
    }
    return false;
  }

  /** Days left until subscription ends. Negative = already expired. null = no sub date or still on trial. */
  get subscriptionDaysLeft(): number | null {
    if (!this.companyProfile?.subscriptionTo) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(this.companyProfile.subscriptionTo);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Spotlight Effect
  dashMouseX = 50;
  dashMouseY = 50;
  isDashHovered = false;

  onHeroMouseMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.dashMouseX = ((event.clientX - rect.left) / rect.width) * 100;
    this.dashMouseY = ((event.clientY - rect.top) / rect.height) * 100;
  }

  // --- Testimonials Slider Logic ---
  currentTestimonialIndex = 0;
  testimonials = [
    {
      quote: "DealVoice understands sales. Our reps were skeptical at first two weeks in, nobody wanted to go back. Follow-ups that used to slip through the cracks now get closed on time, at a higher conversion rate.",
      author: "Rajesh Kumar",
      title: "Head of Sales, Regional Distribution Company",
      image: "assets/images/testimony/person 1.webp",
      logo: "assets/images/logo-1.png",
      stats: [
        { value: "15 hrs", label: "saved per month per sales rep", icon: "arrow" },
        { value: "99%", label: "user satisfaction score", icon: "arrow" }
      ]
    },
    {
      quote: "DealVoice completely changed how our team handles sales. What used to take hours of manual follow-ups and tracking is now automated and organized. Within weeks, our team saw faster responses, better conversions, and no lead slipping through the cracks.",
      author: "Murugan",
      title: "Sales Head, KAG Tiles",
      image: "assets/images/testimony/person 2.webp",
      logo: "assets/images/logo-2.png",
      stats: [
        { value: "12 hrs", label: "saved per month per user", icon: "arrow" },
        { value: "95%", label: "user satisfaction score", icon: "arrow" }
      ]
    },
    {
      quote: "Managing a team of 20 reps used to feel like chaos deals falling through, no visibility, constant follow-ups missed. DealVoice gave us a real-time view of every rep's performance and every deal in the pipeline. Our close rate jumped in the first month.",
      author: "Priya Menon",
      title: "Sales Manager, Viruksham Innovations",
      image: "assets/images/testimony/person 2.webp",
      logo: "assets/images/logo-2.png",
      stats: [
        { value: "30%", label: "Increase in deal close rate", icon: "arrow" },
        { value: "3X", label: "faster follow-up response time", icon: "arrow" }
      ]
    }
  ];

  nextTestimonial(): void {
    this.currentTestimonialIndex = (this.currentTestimonialIndex + 1) % this.testimonials.length;
  }

  prevTestimonial(): void {
    this.currentTestimonialIndex = (this.currentTestimonialIndex - 1 + this.testimonials.length) % this.testimonials.length;
  }

  /** Show the due-end alert if ≤7 days remaining (including expired) */
  get showDueAlert(): boolean {
    if (!this.loggedIn || !this.companyProfile) return false;
    const days = this.subscriptionDaysLeft;
    if (days === null) return false;
    return days <= 7;
  }

  openTrialSignup(): void {
    this.isTrialRequest = true;
    this.openSignup();
  }

  loginForm: LoginPayload = { email: '', password: '' };
  loginError = '';
  loginLoading = false;

  pwdChecks = { length: false, upper: false, number: false, symbol: false };

  readonly INDUSTRIES = [
    'IT / ITES', 'BPO / KPO', 'Banking & Finance', 'Healthcare',
    'Retail & E-commerce', 'Manufacturing', 'Telecom', 'Education',
    'Real Estate', 'Other',
  ];

  // ── Dashboard session ──────────────────────────────────────
  loggedIn = false;
  dashboardCompany = '';
  dashboardCode = '';
  dashboardTeamSize = 0;

  // ── UI panels ──────────────────────────────────────────────
  isMobileMenuOpen = false;
  isLoginOpen = false;
  isSignupOpen = false;
  isForgotPwdOpen = false;
  isResetPwdOpen = false;

  forgotEmail = '';
  forgotLoading = false;
  forgotError = '';
  forgotSuccess = '';

  resetTokenValue = '';
  resetNewPassword = '';
  resetConfirmPassword = '';
  resetLoading = false;
  resetError = '';
  resetSuccess = '';
  resetPwdChecks = { length: false, upper: false, number: false, symbol: false };

  // ── Dashboard tabs ─────────────────────────────────────────
  dashTab: 'overview' | 'employees' | 'reports' | 'company' | 'support' = 'overview';
  showShareModal = false;
  shareMessage = '';
  isLogoutConfirmOpen = false;

  // ── Support & RM ───────────────────────────────────────────
  rmRequestLoading = false;
  rmRequestMessage = '';

  adminRm = {
    name: '',
    phone: '',
    email: '',
    workingDays: '',
    workingHours: ''
  };
  adminRmLoading = false;
  rmCountdown = '';

  openLogin(): void {
    this.closeModals();
    this.isLoginOpen = true;
    this.loginError = '';
  }

  openSignup(): void {
    this.closeModals();
    this.isSignupOpen = true;
    this.signupError = '';
    this.signupSuccess = false;
  }

  openForgotPwd(): void {
    this.closeModals();
    this.isForgotPwdOpen = true;
    this.forgotError = '';
    this.forgotSuccess = '';
    this.forgotEmail = '';
  }

  openForgotFromSettings(): void {
    const email = this.companyProfile?.email || '';
    this.openForgotPwd();
    this.forgotEmail = email;
  }

  closeModals(): void {
    this.isLoginOpen = false;
    this.isSignupOpen = false;
    this.isMobileMenuOpen = false;
    this.isForgotPwdOpen = false;
    this.isResetPwdOpen = false;
    this.showShareModal = false;
    this.isAddEmployeeOpen = false;
    this.isEditEmployeeOpen = false;
    this.showAllCallsModal = false;
    this.isLogoutConfirmOpen = false;
  }
  private rmTimerInterval: any;

  get canRequestRm(): boolean {
    if (!this.companyProfile) return false;
    if (!this.companyProfile.rmRequestTime) return true;
    const hoursSinceRequest = (Date.now() - new Date(this.companyProfile.rmRequestTime).getTime()) / (1000 * 60 * 60);
    return hoursSinceRequest >= 8;
  }

  // ── Advanced Filters ──────────────────────────────────────
  filterTags = '';
  filterEmployees = '';
  filterCallType = '';
  filterDuration = '';
  filterCallTime = '';
  excludePhoneNumbers = false;

  tagOptions = ['Sales', 'Support', 'Admin', 'Marketing'];
  callTypeOptions = ['Incoming', 'Outgoing', 'Missed', 'Rejected'];
  durationOptions = ['< 1 min', '1-5 min', '> 5 min'];
  timeOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];

  // ── Period selector ────────────────────────────────────────
  selectedPeriod: 'today' | 'yesterday' | 'lastweek' | 'custom' = 'today';
  customFrom = new Date().toISOString().split('T')[0];
  customTo = new Date().toISOString().split('T')[0];
  readonly periods = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'lastweek', label: 'Last Week' },
    { key: 'custom', label: 'Custom' },
  ];
  get todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ── Stats ──────────────────────────────────────────────────
  summaryStats: CallStats | null = null;
  summaryLoading = false;

  // ── Tag Management ──────────────────────────────────────────
  newTagInput = '';
  tagManagementLoading = false;
  tagManagementError = '';
  tagManagementSuccess = '';

  // ── Employee list ──────────────────────────────────────────
  employees: Employee[] = [];
  employeesLoading = false;
  employeesError = '';
  isAddEmployeeOpen = false;
  addEmployeeLoading = false;
  addEmployeeError = '';
  newEmployee = { name: '', mobile: '', countryCode: '+91' };
  countryCodes = [
    { name: 'India', code: '+91', flag: '🇮🇳' },
    { name: 'USA', code: '+1', flag: '🇺🇸' },
    { name: 'UK', code: '+44', flag: '🇬🇧' },
    { name: 'UAE', code: '+971', flag: '🇦🇪' },
    { name: 'Australia', code: '+61', flag: '🇦🇺' },
    { name: 'Singapore', code: '+65', flag: '🇸🇬' }
  ];

  isEditEmployeeOpen = false;
  editEmployeeLoading = false;
  editEmployeeError = '';
  editingEmployee: any = { _id: '', name: '', mobile: '', tags: [] };

  employeeCallRows: { emp: Employee; stats: any }[] = [];
  empCallLoading = false;
  empCallError = '';
  syncAllLoading = false;
  syncEmpLoading = false;
  sidebarOpen = false;
  sidebarMinimized = false;

  // ── Employee drilldown ─────────────────────────────────────
  selectedEmployee: Employee | null = null;
  selectedEmpStats: CallStats | null = null;
  selectedEmpLoading = false;
  selectedEmpCalls: any[] = [];
  selectedEmpCallsLoading = false;
  drilldownTab: 'stats' | 'calls' = 'stats';

  // ── Chart state ────────────────────────────────────────────
  chartType: 'line' | 'pie' | 'bar' = 'pie';
  chart: Chart | null = null;

  overviewChartType: 'pie' | 'bar' = 'pie';
  overviewChart: Chart | null = null;
  timelineChart: Chart | null = null;
  donutChart: Chart | null = null;
  timelineData: any[] = [];

  // ── Preloaded Data Caches ───────────────────────────────────
  preloadedCache: Record<string, { summary: any, timeline: any, employees: any, prevSummary: any, summaryLoaded: boolean, timelineLoaded: boolean, employeesLoaded: boolean, prevSummaryLoaded: boolean }> = {
    today: { summary: null, timeline: [], employees: [], prevSummary: null, summaryLoaded: false, timelineLoaded: false, employeesLoaded: false, prevSummaryLoaded: false },
    yesterday: { summary: null, timeline: [], employees: [], prevSummary: null, summaryLoaded: false, timelineLoaded: false, employeesLoaded: false, prevSummaryLoaded: false },
    lastweek: { summary: null, timeline: [], employees: [], prevSummary: null, summaryLoaded: false, timelineLoaded: false, employeesLoaded: false, prevSummaryLoaded: false }
  };

  // ── Company Profile ────────────────────────────────────────
  companyProfile: any = null;
  companyProfileLoading = false;

  changePwdForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
  changePwdLoading = false;
  changePwdError = '';

  get filteredEmployeeCallRows() {
    return this.employeeCallRows.filter(row => {
      // Filter by Tags
      if (this.filterTags && (!row.emp.tags || !row.emp.tags.includes(this.filterTags))) return false;

      // Filter by Employee mobile
      if (this.filterEmployees && row.emp.mobile !== this.filterEmployees) return false;

      return true;
    });
  }
  changePwdSuccess = '';
  changePwdChecks = { length: false, upper: false, number: false, symbol: false };

  onResetPasswordInput(val: string): void {
    this.resetNewPassword = val;
    this.resetPwdChecks.length = val.length >= 8;
    this.resetPwdChecks.upper = /[A-Z]/.test(val);
    this.resetPwdChecks.number = /[0-9]/.test(val);
    this.resetPwdChecks.symbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val);
  }

  get isResetPasswordStrong(): boolean {
    return Object.values(this.resetPwdChecks).every(v => v === true);
  }

  editingAddress = false;
  editAddressValue = '';
  saveAddressLoading = false;
  saveAddressError = '';
  saveAddressSuccess = '';

  editingTeamSize = false;
  editTeamSizeValue = '';
  saveTeamSizeLoading = false;
  saveTeamSizeError = '';
  saveTeamSizeSuccess = '';

  // Employee Tagging Inline
  editTagEmpId: string | null = null;
  inlineTagValue: string = '';
  activeEmployeeCount: number = 0; // State for dashboard cards
  showInlineDropdown: string | null = null;
  savingTag = false;

  // View All Calls Modal
  showAllCallsModal = false;

  today = new Date();

  constructor(
    private authService: AuthService,
    private employeeService: EmployeeService,
    private callLogService: CallLogService,
    private paymentService: PaymentService,
  ) { }

  ngOnInit(): void {
    Chart.register(...registerables);
    const raw = localStorage.getItem('tracecall_user');
    if (raw) {
      try {
        const user = JSON.parse(raw);
        this.loggedIn = true;
        this.dashboardCompany = user.companyName || 'Your Company';
        this.dashboardCode = user.companyCode || '';
        this.dashboardTeamSize = parseInt(user.teamSize) || 0;
        this._loadDashboard();
      } catch { localStorage.removeItem('tracecall_user'); }
    }

    // Check for reset token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (token) {
      this.resetTokenValue = token;
      this.isResetPwdOpen = true;
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  switchTab(tab: any): void {
    const prevTab = this.dashTab;
    this.dashTab = tab;
    this.sidebarOpen = false;

    // Reset period to 'today' when moving from Reports back to Overview/Employees
    // unless specifically requested otherwise. This prevents getting stuck in 'custom' filters.
    if ((tab === 'overview' || tab === 'employees') && this.selectedPeriod === 'custom') {
      this.onPeriodChange('today');
    }

    // If switching back to overview and we have data, ensure charts are rendered
    // (since *ngIf removes the canvas from DOM when switching tabs)
    if (tab === 'overview' && prevTab !== 'overview') {
      setTimeout(() => {
        if (this.summaryStats) this.renderDonutChart();
        if (this.timelineData.length) this.renderTimelineChart();
      }, 100);
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  fmtDur(seconds: number): string {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  shortDur(seconds: number): string {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  // Returns avg call duration formatted as Xm Ys (based on connected calls)
  fmtAvgDur(totalDuration: number, connectedCalls: number): string {
    if (!connectedCalls || !totalDuration) return '0s';
    const avg = Math.round(totalDuration / connectedCalls);
    const m = Math.floor(avg / 60);
    const s = avg % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  fmtDate(d: string | undefined | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  fmtTime(ts: string | number | undefined): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  periodLabel(p: string): string {
    return this.periods.find(x => x.key === p)?.label ?? p;
  }

  // ── Dashboard loader ──────────────────────────────────────
  _loadDashboard(): void {
    this.companyProfileLoading = true;
    this.fetchCompanyProfile();
    this.fetchEmployees();
    this.fetchPaymentHistory();
    // Preload past 7 days data on load to avoid spinners when toggling periods
    this.preloadDashboardData();
  }

  preloadDashboardData(): void {
    this.summaryLoading = true;
    this.empCallLoading = true;

    const periods = ['today', 'yesterday', 'lastweek'];
    let loadedCount = 0;

    periods.forEach(period => {
      // Fetch summary
      this.callLogService.getSummary(this.dashboardCode, period).subscribe({
        next: (res: any) => {
          this.preloadedCache[period].summaryLoaded = true;
          if (res.success) {
            this.preloadedCache[period].summary = res.stats;
            this.fetchPreviousStatsForCache(res.from, res.to, period);
          }
          if (period === this.selectedPeriod) this.applyFilterLocally();
        },
        error: () => {
          this.preloadedCache[period].summaryLoaded = true;
          if (period === this.selectedPeriod) this.applyFilterLocally();
        }
      });

      // Fetch timeline
      this.callLogService.getTimeline(this.dashboardCode, period).subscribe({
        next: (res: any) => {
          this.preloadedCache[period].timelineLoaded = true;
          if (res.success) {
            this.preloadedCache[period].timeline = res.timeline;
          }
          if (period === this.selectedPeriod) this.applyFilterLocally();
        },
        error: () => {
          this.preloadedCache[period].timelineLoaded = true;
          if (period === this.selectedPeriod) this.applyFilterLocally();
        }
      });

      // Fetch employees stats
      this.callLogService.getEmployeesStats(this.dashboardCode, period).subscribe({
        next: (res: any) => {
          this.preloadedCache[period].employeesLoaded = true;
          if (res.success) {
            this.preloadedCache[period].employees = res.employees;
          }
          if (period === this.selectedPeriod) this.applyFilterLocally();
        },
        error: () => {
          this.preloadedCache[period].employeesLoaded = true;
          if (period === this.selectedPeriod) this.applyFilterLocally();
        }
      });
    });
  }

  // We rewrite fetchSummary to instantly return preloaded data if available, and to show loading ONLY if not.
  fetchSummary(forceReload = false): void {
    // If we have it preloaded, skip hitting the API
    if (!forceReload && this.selectedPeriod !== 'custom' && this.preloadedCache[this.selectedPeriod].summaryLoaded) {
      this.applyFilterLocally();
      return;
    }

    this.summaryLoading = true;
    this.summaryStats = null;

    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    if (this.donutChart) { this.donutChart.destroy(); this.donutChart = null; }

    this.callLogService.getSummary(
      this.dashboardCode, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.summaryStats = res.stats;
          this.fetchPreviousStats(res.from, res.to);

          setTimeout(() => {
            this.renderDonutChart();
            if (this.timelineData.length) this.renderTimelineChart();
          }, 500);

        } else {
          this.summaryLoading = false;
        }
      },
      error: () => { this.summaryLoading = false; }
    });

    this.callLogService.getTimeline(
      this.dashboardCode, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.timelineData = res.timeline;
          setTimeout(() => this.renderTimelineChart(), 350);
        }
      },
      error: () => { }
    });
  }

  kpiMetrics = {
    connectRate: 0,
    durationProgress: 0,
    totalCallsProgress: 0,
    missedRate: 0,
    trends: { connected: 0, duration: 0, total: 0, missed: 0 }
  };

  fetchPreviousStats(currentFrom: string, currentTo: string): void {
    const fromDate = new Date(currentFrom);
    const toDate = new Date(currentTo || currentFrom);
    const diff = toDate.getTime() - fromDate.getTime();
    const prevTo = new Date(fromDate.getTime() - (24 * 60 * 60 * 1000));
    const prevFrom = new Date(prevTo.getTime() - diff);

    const fromStr = prevFrom.toISOString().split('T')[0];
    const toStr = prevTo.toISOString().split('T')[0];

    this.callLogService.getSummary(this.dashboardCode, 'custom', fromStr, toStr).subscribe({
      next: (res: any) => {
        this.summaryLoading = false;
        if (res.success && res.stats) {
          this.calculateMetrics(this.summaryStats!, res.stats);
        } else {
          this.calculateMetrics(this.summaryStats!, null);
        }
      },
      error: () => {
        this.summaryLoading = false;
        this.calculateMetrics(this.summaryStats!, null);
      }
    });
  }

  fetchPreviousStatsForCache(currentFrom: string, currentTo: string, period: string): void {
    const fromDate = new Date(currentFrom);
    const toDate = new Date(currentTo || currentFrom);
    const diff = toDate.getTime() - fromDate.getTime();
    const prevTo = new Date(fromDate.getTime() - (24 * 60 * 60 * 1000));
    const prevFrom = new Date(prevTo.getTime() - diff);

    const fromStr = prevFrom.toISOString().split('T')[0];
    const toStr = prevTo.toISOString().split('T')[0];

    this.callLogService.getSummary(this.dashboardCode, 'custom', fromStr, toStr).subscribe({
      next: (res: any) => {
        this.preloadedCache[period].prevSummaryLoaded = true;
        if (res.success && res.stats) {
          this.preloadedCache[period].prevSummary = res.stats;
        }
        if (this.selectedPeriod === period) this.applyFilterLocally();
      },
      error: () => {
        this.preloadedCache[period].prevSummaryLoaded = true;
        if (this.selectedPeriod === period) this.applyFilterLocally();
      }
    });
  }

  calculateMetrics(curr: CallStats, prev: CallStats | null): void {
    const total = curr.total || 0;
    const connected = curr.connected || 0;

    // Rates (0–1)
    this.kpiMetrics.connectRate = total ? (connected / total) : 0;
    this.kpiMetrics.missedRate = total ? (curr.missed / total) : 0;

    if (prev && prev.total) {
      // Progress relative to previous period (capped at 1.0 = 100%)
      this.kpiMetrics.durationProgress = Math.min(curr.totalDuration / Math.max(prev.totalDuration, 1), 1);
      this.kpiMetrics.totalCallsProgress = Math.min(total / Math.max(prev.total, 1), 1);
      // Trends vs previous period
      this.kpiMetrics.trends.connected = this.calcTrend(connected, prev.connected);
      this.kpiMetrics.trends.total = this.calcTrend(curr.total, prev.total);
      this.kpiMetrics.trends.duration = this.calcTrend(curr.totalDuration, prev.totalDuration);
      this.kpiMetrics.trends.missed = this.calcTrend(curr.missed, prev.missed);
    } else {
      // No previous data — use rates as progress indicators
      this.kpiMetrics.durationProgress = this.kpiMetrics.connectRate; // fallback: mirror connect rate
      this.kpiMetrics.totalCallsProgress = total > 0 ? 1 : 0;           // full if there are calls
      this.kpiMetrics.trends = { connected: 0, duration: 0, total: 0, missed: 0 };
    }
  }

  calcTrend(curr: number, prev: number): number {
    if (!prev) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  onPeriodChange(p: string): void {
    this.selectedPeriod = p as any;
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    if (this.donutChart) { this.donutChart.destroy(); this.donutChart = null; }

    if (p !== 'custom') {
      // If we're toggling locally without spinners (today, yesterday, lastweek)
      this.applyFilterLocally();
      if (this.selectedEmployee) this.openEmployee(this.selectedEmployee); // drilldowns need a specific api hit
    }
  }

  // Attempts to switch to current period view instantly without hitting the API for standard views
  applyFilterLocally(): void {
    if (this.selectedPeriod === 'custom') {
      return; // Custom is handled by its explicit apply event and fetch commands
    }

    const cache = this.preloadedCache[this.selectedPeriod];

    // Only parse and display everything IF the big 3 are completely loaded, AND the employees list is loaded
    if (cache.summaryLoaded && cache.timelineLoaded && cache.employeesLoaded) {
      this.summaryStats = cache.summary || null;
      this.timelineData = cache.timeline || [];

      // We only compute metrics if prev is loaded too, or we fallback if the summary API call was successful
      if (cache.prevSummaryLoaded && cache.summary) {
        this.calculateMetrics(this.summaryStats!, cache.prevSummary);
      } else if (cache.summary) {
        this.calculateMetrics(this.summaryStats!, null);
      }

      // Delay map employee stats until `this.employees` array is successfully populated
      if (!this.employeesLoading) {
        this.mapEmployeeStats(cache.employees || []);
        this.empCallLoading = false;
      }

      setTimeout(() => {
        if (this.summaryStats) this.renderDonutChart();
        if (this.timelineData && this.timelineData.length) this.renderTimelineChart();
      }, 50);

      this.summaryLoading = false;
    }
  }

  mapEmployeeStats(stats: any[]): void {
    this.empCallLoading = false;
    const statsMap: Record<string, any> = {};
    for (const s of stats) statsMap[s.phone] = s;
    this.employeeCallRows = this.employees.map(emp => ({
      emp,
      stats: statsMap[emp.mobile] ?? null,
    }));

    // Count employees who have at least 1 call in the current period
    this.activeEmployeeCount = this.employeeCallRows.filter(r => r.stats && (r.stats.total || 0) > 0).length;
  }

  applyCustomRange(): void {
    if (!this.customFrom) return;
    this.selectedPeriod = 'custom';
    this.fetchSummary();
    this.fetchEmployeeCallRows();
    if (this.selectedEmployee) this.openEmployee(this.selectedEmployee);
  }

  fetchEmployees(): void {
    if (!this.dashboardCode) return;
    this.employeesLoading = true;
    this.employeesError = '';
    this.employeeService.getEmployees(this.dashboardCode).subscribe({
      next: (res: any) => {
        this.employeesLoading = false;
        if (res.success && res.employees) {
          this.employees = res.employees;

          if (this.selectedPeriod !== 'custom') {
            // Let the locally loaded trigger map it if cache is ready
            const cache = this.preloadedCache[this.selectedPeriod];
            if (cache.employeesLoaded) {
              this.mapEmployeeStats(cache.employees || []);
              this.empCallLoading = false;
            }
          } else {
            this.fetchEmployeeCallRows();
          }
        } else {
          this.employeesError = res.message || 'Failed to load employees.';
        }
      },
      error: (err: any) => {
        this.employeesLoading = false;
        this.employeesError = err?.error?.message || 'Server error: Could not connect to the server. Please try again.';
      }
    });
  }

  fetchEmployeeCallRows(forceRefresh = false): void {
    if (!this.dashboardCode) return;

    // Check if we can just use the preloaded array
    if (!forceRefresh && this.selectedPeriod !== 'custom') {
      const cache = this.preloadedCache[this.selectedPeriod];
      if (cache.employeesLoaded) {
        this.mapEmployeeStats(cache.employees || []);
        this.empCallLoading = false;
      } else {
        // Wait for preload dashboard
        this.empCallLoading = true;
      }
      return;
    }

    this.empCallLoading = true;
    this.empCallError = '';

    const filters = this.dashTab === 'reports' ? {
      callType: this.filterCallType,
      duration: this.filterDuration,
      callTime: this.filterCallTime,
    } : null;

    this.callLogService.getEmployeesStats(
      this.dashboardCode, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
      filters
    ).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.mapEmployeeStats(res.employees);
        } else {
          this.empCallLoading = false;
          this.empCallError = res.message || 'Failed to load call data.';
        }
      },
      error: (err: any) => {
        this.empCallLoading = false;
        this.empCallError = err?.error?.message || 'Server error: Could not load call statistics.';
      }
    });
  }

  syncAll(): void {
    this.syncAllLoading = true;

    if (this.selectedPeriod === 'custom') {
      this.fetchSummary();
      this.fetchEmployeeCallRows();
    } else {
      // Force API fetch and overwrite cache
      this.fetchSummary(true);
      this.fetchEmployeeCallRows(true);
    }
    this.fetchEmployees();
    setTimeout(() => this.syncAllLoading = false, 1500);
  }

  syncEmployee(): void {
    if (!this.selectedEmployee) return;
    this.syncEmpLoading = true;
    this.openEmployee(this.selectedEmployee);
    setTimeout(() => this.syncEmpLoading = false, 1500);
  }

  // ── Employee drilldown ────────────────────────────────────
  openEmployee(emp: Employee): void {
    this.selectedEmployee = emp;
    this.selectedEmpStats = null;
    this.selectedEmpCalls = [];
    this.selectedEmpLoading = true;
    this.selectedEmpCallsLoading = true;
    this.drilldownTab = 'stats';

    this.callLogService.getEmployeeStat(
      this.dashboardCode, emp.mobile, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        this.selectedEmpLoading = false;
        if (res.success) this.selectedEmpStats = res.stats;
      },
      error: () => { this.selectedEmpLoading = false; }
    });

    this.callLogService.getCallDetails(
      this.dashboardCode, emp.mobile, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        this.selectedEmpCallsLoading = false;
        if (res.success) {
          this.selectedEmpCalls = res.calls;
          setTimeout(() => this.renderChart(), 100);
        }
      },
      error: () => { this.selectedEmpCallsLoading = false; }
    });
  }

  selectEmployee(emp: Employee) { this.openEmployee(emp); }

  closeEmployee(): void {
    this.selectedEmployee = null;
    this.selectedEmpStats = null;
  }

  setChartType(type: 'line' | 'pie' | 'bar'): void {
    this.chartType = type;
    this.renderChart();
  }

  setOverviewChartType(type: 'pie' | 'bar'): void {
    this.overviewChartType = type;
    this.renderOverviewChart();
  }

  // ── Chart renderers ───────────────────────────────────────

  renderOverviewChart(): void {
    if (this.overviewChart) { this.overviewChart.destroy(); this.overviewChart = null; }
    const canvas = document.getElementById('overviewChart') as HTMLCanvasElement;
    if (!canvas || !this.summaryStats) return;

    const textColor = 'rgba(59,59,59,0.7)';
    const gridColor = 'rgba(0,0,0,0.05)';
    const s = this.summaryStats;
    const counts = {
      incoming: s.incoming || 0, outgoing: s.outgoing || 0,
      missed: s.missed || 0, rejected: s.rejected || 0
    };

    const data = {
      labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
      datasets: [{
        label: 'Call Count',
        data: [counts.incoming, counts.outgoing, counts.missed, counts.rejected],
        backgroundColor: ['#22c55e', '#f97316', '#ef4444', '#ec4899'],
        borderWidth: this.overviewChartType === 'pie' ? 2 : 0,
        borderColor: '#ffffff',
        borderRadius: this.overviewChartType === 'bar' ? 6 : 0,
        barPercentage: 0.6
      }]
    };
    const options: any = {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: this.overviewChartType === 'pie', position: 'right',
          labels: { color: textColor, font: { size: 12 }, padding: 15 }
        },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, cornerRadius: 8 }
      },
      scales: this.overviewChartType === 'bar' ? {
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, padding: 8 } },
        x: { grid: { display: false }, ticks: { color: textColor, padding: 8 } }
      } : undefined
    };
    this.overviewChart = new Chart(canvas, { type: this.overviewChartType, data, options });
  }

  renderTimelineChart(): void {
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    const canvas = document.getElementById('timelineChart') as HTMLCanvasElement;
    if (!canvas || !canvas.offsetParent) {
      setTimeout(() => this.renderTimelineChart(), 200);
      return;
    }

    const isHourly = this.timelineData.length > 0 && this.timelineData[0]._isHourly;
    const labels = this.timelineData.map(d => {
      const dt = new Date(d.date);
      if (isHourly) {
        // Show hours: 08 AM, 02 PM, etc.
        const h = dt.getHours();
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        return `${String(displayH).padStart(2, '0')} ${ampm}`;
      }
      return dt.toLocaleDateString('en-US', { weekday: 'short' });
    });
    const totalCalls = this.timelineData.map(d =>
      (d.incoming || 0) + (d.outgoing || 0) + (d.missed || 0) + (d.rejected || 0)
    );

    const textColor = 'rgba(80,80,100,0.6)';
    const gridColor = 'rgba(0,0,0,0.04)';
    const ctx = canvas.getContext('2d');
    const grad = ctx ? ctx.createLinearGradient(0, 0, 0, 260) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(61,125,254,0.18)');
      grad.addColorStop(1, 'rgba(61,125,254,0)');
    }

    this.timelineChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No data'],
        datasets: [{
          label: 'Total Calls',
          data: totalCalls.length ? totalCalls : [0],
          borderColor: '#3D7DFE',
          backgroundColor: grad ?? 'rgba(61,125,254,0.1)',
          fill: true,
          tension: 0.45,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#3D7DFE',
          pointBorderWidth: 2,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,0.95)',
            titleColor: '#111', bodyColor: '#444',
            borderColor: '#e5e7eb', borderWidth: 1,
            padding: 10, cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 11 }, maxRotation: 0, padding: 8 }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor, font: { size: 11 }, padding: 8,
              callback: (value: any) => value >= 1000 ? (value / 1000) + 'k' : value
            },
            grid: { color: gridColor },
            border: { display: false }
          }
        }
      }
    });
  }

  renderDonutChart(): void {
    if (this.donutChart) {
      this.donutChart.destroy();
      this.donutChart = null;
    }

    const canvas = document.getElementById('donutChart') as HTMLCanvasElement;

    // Guard: canvas not in DOM yet or hidden
    if (!canvas || !canvas.offsetParent) {
      setTimeout(() => this.renderDonutChart(), 200);
      return;
    }

    if (!this.summaryStats) return;

    const s = this.summaryStats;
    this.donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
        datasets: [{
          data: [s.incoming || 0, s.outgoing || 0, s.missed || 0, s.rejected || 0],
          backgroundColor: ['#3b82f6', '#22c55e', '#f87171', '#f59e0b'],
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,0.95)',
            titleColor: '#111', bodyColor: '#444',
            borderColor: '#e5e7eb', borderWidth: 1,
            padding: 10, cornerRadius: 8
          }
        }
      }
    });
  }

  renderChart(): void {
    if (this.chart) { this.chart.destroy(); this.chart = null; }
    const canvas = document.getElementById('empChart') as HTMLCanvasElement;
    if (!canvas || !this.selectedEmpCalls.length) return;

    const textColor = 'rgba(59,59,59,0.7)';
    const gridColor = 'rgba(255,255,255,0.05)';
    let data: any, options: any;

    if (this.chartType === 'pie' || this.chartType === 'bar') {
      const counts = { incoming: 0, outgoing: 0, missed: 0, rejected: 0 };
      this.selectedEmpCalls.forEach(c => {
        if (c.callType in counts) (counts as any)[c.callType]++;
      });
      data = {
        labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
        datasets: [{
          label: 'Call Count',
          data: [counts.incoming, counts.outgoing, counts.missed, counts.rejected],
          backgroundColor: ['#22c55e', '#f97316', '#ef4444', '#ec4899'],
          borderWidth: this.chartType === 'pie' ? 2 : 0,
          borderColor: '#ffffff',
          borderRadius: this.chartType === 'bar' ? 6 : 0,
          barPercentage: 0.6
        }]
      };
      options = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            display: this.chartType === 'pie', position: 'right',
            labels: { color: textColor, font: { size: 12 }, padding: 15 }
          },
          tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, cornerRadius: 8 }
        },
        scales: this.chartType === 'bar' ? {
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, padding: 8 } },
          x: { grid: { display: false }, ticks: { color: textColor, padding: 8 } }
        } : undefined
      };
    } else {
      // Line chart
      const map = new Map<string, number>();
      const calls = [...this.selectedEmpCalls].reverse();
      calls.forEach(c => {
        const d = new Date(c.timestamp);
        const k = (this.selectedPeriod === 'today' || this.selectedPeriod === 'yesterday')
          ? (d.getHours() % 12 || 12) + (d.getHours() >= 12 ? ' PM' : ' AM')
          : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        map.set(k, (map.get(k) || 0) + 1);
      });

      const ctx = canvas.getContext('2d');
      let gradient: any = 'rgba(99,102,241,0.2)';
      if (ctx) {
        gradient = ctx.createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, 'rgba(99,102,241,0.4)');
        gradient.addColorStop(1, 'rgba(99,102,241,0.0)');
      }

      data = {
        labels: Array.from(map.keys()),
        datasets: [{
          label: 'Calls Made/Received',
          data: Array.from(map.values()),
          borderColor: '#6366f1',
          backgroundColor: gradient,
          fill: true, tension: 0.4,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#fff', pointBorderWidth: 2,
          pointRadius: 4, pointHoverRadius: 6, borderWidth: 3
        }]
      };
      options = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, cornerRadius: 8, displayColors: false }
        },
        interaction: { intersect: false, mode: 'index' },
        scales: {
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, padding: 8 } },
          x: { grid: { display: false }, ticks: { color: textColor, maxRotation: 45, padding: 8 } }
        }
      };
    }

    this.chart = new Chart(canvas, { type: this.chartType, data, options });
  }

  // ── Auth flows ────────────────────────────────────────────
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
  // (Original duplicates removed here. Modal methods moved to top)

  onForgotPwdSubmit(event: Event): void {
    event.preventDefault();
    if (!this.forgotEmail) return;
    this.forgotLoading = true;
    this.forgotError = '';
    this.forgotSuccess = '';

    this.authService.forgotPassword(this.forgotEmail).subscribe({
      next: (res) => {
        this.forgotLoading = false;
        if (res.success) {
          this.forgotSuccess = res.message;
        } else {
          this.forgotError = res.message;
        }
      },
      error: (err) => {
        this.forgotLoading = false;
        this.forgotError = err?.error?.message || 'Server error. Please try again.';
      }
    });
  }

  onResetPwdSubmit(event: Event): void {
    event.preventDefault();
    if (!this.isResetPasswordStrong) {
      this.resetError = 'Password does not meet strength requirements.';
      return;
    }
    if (this.resetNewPassword !== this.resetConfirmPassword) {
      this.resetError = 'Passwords do not match.';
      return;
    }

    this.resetLoading = true;
    this.resetError = '';
    this.resetSuccess = '';

    this.authService.resetPassword(this.resetTokenValue, this.resetNewPassword).subscribe({
      next: (res) => {
        this.resetLoading = false;
        if (res.success) {
          this.resetSuccess = res.message;
        } else {
          this.resetError = res.message;
        }
      },
      error: (err) => {
        this.resetLoading = false;
        this.resetError = err?.error?.message || 'Server error or invalid token.';
      }
    });
  }

  onPasswordInput(value: string): void {
    this.signupForm.password = value;
    this.pwdChecks = {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      number: /[0-9]/.test(value),
      symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value),
    };
  }

  get passwordStrong(): boolean { return Object.values(this.pwdChecks).every(Boolean); }

  onSignupSubmit(event: Event): void {
    event.preventDefault();
    this.signupError = '';
    if (!this.passwordStrong) { this.signupError = 'Password does not meet strength requirements.'; return; }

    if (this.isTrialRequest) {
      // Trial flow: create account immediately
      this.signupLoading = true;
      this.authService.register({ ...this.signupForm, isTrial: true }).subscribe({
        next: (res) => {
          this.signupLoading = false;
          if (res.success) this.signupSuccess = true;
          else this.signupError = res.message;
        },
        error: (err) => {
          this.signupLoading = false;
          this.signupError = err?.error?.message || 'Something went wrong.';
        },
      });
    } else {
      // Paid flow: payment FIRST, account creation only after payment succeeds
      if (!this.paymentToDate) { this.signupError = 'Please select a subscription end date.'; return; }
      this.signupLoading = true;
      this.launchNewAccountPayment();
    }
  }

  /** PAYMENT-FIRST: Creates order via pre-order, opens Razorpay, account created only on success */
  launchNewAccountPayment(): void {
    this.paymentStep = 'paying';
    this.paymentService.createPreOrder({
      ...this.signupForm,
      toDate: this.paymentToDate,
    }).subscribe({
      next: (order: any) => {
        this.signupLoading = false;
        if (!order.success) {
          this.signupError = 'Failed to create payment order.';
          this.paymentStep = 'idle';
          return;
        }
        this.openRazorpay(order, false);
      },
      error: (err: any) => {
        this.signupLoading = false;
        this.signupError = err?.error?.message || 'Failed to connect to payment server.';
        this.paymentStep = 'idle';
      }
    });
  }

  openRazorpay(order: any, isRenewal: boolean): void {
    if (order.keyId) this.razorpayKeyId = order.keyId;
    const options = {
      key: order.keyId || this.razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Softrate Record',
      description: `Subscription — ${order.days} days`,
      order_id: order.orderId,
      prefill: { name: order.companyName, email: order.email, contact: order.mobile },
      theme: { color: '#6366f1' },
      handler: (response: any) => {
        if (isRenewal) {
          this.paymentService.verifyRenewal({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            companyCode: this.dashboardCode,
          }).subscribe({
            next: (res: any) => {
              this.renewLoading = false;
              if (res.success && this.companyProfile) {
                this.paymentStep = 'done';
                this.companyProfile.subscriptionTo = res.subscriptionTo;
                this.companyProfile.subscriptionFrom = res.subscriptionFrom;
                this.companyProfile.status = 'Paid';
                this.renewCostPreview = null;
                this.renewToDate = '';
                this.fetchPaymentHistory();
              }
            },
            error: () => { this.renewLoading = false; this.paymentStep = 'idle'; }
          });
        } else {
          this.paymentService.verifyNewAccount({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }).subscribe({
            next: (res: any) => {
              if (res.success) {
                this.paymentStep = 'done';
                this.signupSuccess = true;
              }
            },
            error: () => { this.paymentStep = 'idle'; }
          });
        }
      },
      modal: { ondismiss: () => { this.paymentStep = 'idle'; this.signupLoading = false; this.renewLoading = false; } }
    };
    const win = window as any;
    if (win.Razorpay) {
      new win.Razorpay(options).open();
    } else {
      alert('Razorpay SDK not loaded. Please refresh and try again.');
      this.paymentStep = 'idle';
      this.signupLoading = false;
    }
  }

  renewSubscription(): void {
    if (!this.renewToDate || !this.dashboardCode) return;
    this.renewLoading = true;
    this.paymentService.createRenewalOrder(this.dashboardCode, this.renewToDate).subscribe({
      next: (order: any) => {
        if (!order.success) { this.renewLoading = false; return; }
        this.openRazorpay(order, true);
      },
      error: () => { this.renewLoading = false; }
    });
  }

  onRenewToDateChange(): void {
    if (!this.renewToDate || !this.companyProfile?.teamSize) {
      this.renewCostPreview = null;
      return;
    }

    // Today at midnight (local time) — used as the "start" when subscription has expired
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let from: Date;

    if (this.companyProfile?.subscriptionTo) {
      // Parse subscriptionTo in LOCAL time to avoid UTC off-by-one in IST
      const [sY, sM, sD] = this.companyProfile.subscriptionTo.substring(0, 10).split('-').map(Number);
      const subEnd = new Date(sY, sM - 1, sD, 23, 59, 59, 999);

      if (subEnd >= today) {
        // Subscription still active → start from the day AFTER it ends
        from = new Date(sY, sM - 1, sD + 1, 0, 0, 0, 0);
      } else {
        // Subscription already expired → start from today
        from = today;
      }
    } else {
      // No subscription at all → start from today
      from = today;
    }

    // Parse the user-selected end date in LOCAL time
    const [toY, toM, toD] = this.renewToDate.split('-').map(Number);
    const to = new Date(toY, toM - 1, toD, 23, 59, 59, 999);
    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

    const teamSizeVal = parseInt(this.companyProfile.teamSize.toString(), 10);
    const teamSizeMax = isNaN(teamSizeVal) ? 10 : teamSizeVal;

    const subtotal = teamSizeMax * 10 * days;
    const tax = subtotal * 0.18;
    this.renewCostPreview = { days, teamSizeMax, amountRupees: parseFloat((subtotal + tax).toFixed(2)) };
  }

  onToDateChange(): void {
    if (!this.paymentToDate || !this.signupForm.teamSize) {
      this.paymentCostPreview = null;
      return;
    }
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    // Parse the date string in LOCAL time to avoid UTC off-by-one in IST (and other UTC+ zones).
    const [toY, toM, toD] = this.paymentToDate.split('-').map(Number);
    const to = new Date(toY, toM - 1, toD, 23, 59, 59, 999);
    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

    // teamSize is now a direct number input, fallback to 10 if invalid
    const teamSizeVal = parseInt(this.signupForm.teamSize.toString(), 10);
    const teamSizeMax = isNaN(teamSizeVal) ? 10 : teamSizeVal;

    const subtotal = teamSizeMax * 10 * days;
    const tax = subtotal * 0.18;
    this.paymentCostPreview = { days, teamSizeMax, amountRupees: parseFloat((subtotal + tax).toFixed(2)) };
  }

  fetchPaymentHistory(): void {
    if (!this.dashboardCode) return;
    this.paymentHistoryLoading = true;
    this.paymentService.getHistory(this.dashboardCode).subscribe({
      next: (res) => {
        this.paymentHistoryLoading = false;
        if (res.success) {
          this.paymentHistory = res.payments;
          if ((res as any).keyId) this.razorpayKeyId = (res as any).keyId;
        }
      },
      error: () => { this.paymentHistoryLoading = false; }
    });
  }

  deleteOrder(id: string): void {
    if (!confirm('Are you sure you want to delete this unpaid order?')) return;
    this.paymentService.deleteOrder(id).subscribe({
      next: (res) => {
        if (res.success) this.fetchPaymentHistory();
        else alert(res.message || 'Failed to delete order.');
      },
      error: (err) => alert(err?.error?.message || 'Server error.')
    });
  }

  retryPayment(p: any): void {
    const orderData = {
      orderId: p.razorpayOrderId,
      amount: p.amount,
      currency: 'INR',
      days: p.days,
      companyName: this.companyProfile?.companyName,
      email: this.companyProfile?.email,
      mobile: this.companyProfile?.mobile,
      keyId: this.razorpayKeyId
    };
    this.openRazorpay(orderData, true);
  }

  downloadInvoice(p: any): void {
    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow popups to view the invoice.');
      return;
    }

    const amountRupees = p.amount / 100;
    const days = p.days || 30; // fallback if missing
    const ratePerDay = p.paymentRatePerDay || 10; // fallback if missing

    // Fallback company info if profile is not fully loaded
    const companyName = this.companyProfile?.companyName || 'Valued Customer';
    const companyEmail = this.companyProfile?.email || '';
    const companyAddress = this.companyProfile?.companyAddress || 'No address provided';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice - ${p.razorpayOrderId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 0; }
          body { 
            font-family: 'Inter', system-ui, sans-serif; 
            margin: 0; 
            padding: 0;
            background: #fff;
            color: #1a1a1a;
            -webkit-print-color-adjust: exact;
          }
          .a4-container {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 30mm 20mm;
            box-sizing: border-box;
          }
          .header {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 50px;
          }
          .logo {
            height: 48px;
            margin-bottom: 24px;
          }
          .seller-info {
            text-align: center;
            color: #666;
            font-size: 13px;
            line-height: 1.5;
          }
          .invoice-grid {
            display: grid;
            grid-template-columns: 100px 1fr;
            gap: 40px;
            margin-bottom: 60px;
            font-size: 14px;
          }
          .grid-label {
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #000;
          }
          .grid-content {
            line-height: 1.6;
          }
          .client-name {
            font-weight: 700;
            margin-bottom: 4px;
            font-size: 15px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 40px;
            margin-bottom: 30px;
          }
          th {
            text-align: left;
            padding: 12px 10px;
            border-bottom: 1px solid #eee;
            text-transform: uppercase;
            font-size: 12px;
            color: #666;
            letter-spacing: 0.05em;
          }
          td {
            padding: 20px 10px;
            border-bottom: 1px solid #f9f9f9;
            font-size: 14px;
            vertical-align: top;
          }
          .item-desc {
            font-weight: 600;
            margin-bottom: 4px;
            font-size: 14px;
          }
          .item-subtext {
            color: #666;
            font-size: 12px;
            display: block;
          }
          .summary-container {
            border-top: 2px solid #000;
            padding-top: 30px;
            display: flex;
            justify-content: space-between;
          }
          .summary-item {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }
          .summary-label {
            font-weight: 700;
            text-transform: uppercase;
            font-size: 13px;
            letter-spacing: 0.05em;
          }
          .summary-val {
            font-weight: 400;
            font-size: 14px;
          }
          .grand-total {
            font-size: 32px;
            font-weight: 700;
            color: #000;
          }
          .notes {
            margin-top: 80px;
            padding-top: 20px;
            font-size: 12px;
            color: #666;
            line-height: 1.6;
          }
          .footer-brand {
            margin-top: 10px;
            font-weight: 700;
            font-size: 14px;
            color: #000;
          }
          @media print {
            body { background: none; }
            .a4-container { margin: 0; padding: 25mm 15mm; }
          }
        </style>
      </head>
      <body>
        <div class="a4-container">
          <div class="header">
            <img class="logo" src="/assets/icon/logo.png" alt="DealVoice">
            <div class="seller-info">
              Softrate Technologies Private Limited<br>
              dealvoice.co | support@softrate.com | GSTN: 33ABKCS4479F1Z2
            </div>
          </div>

          <div class="invoice-grid">
            <div class="grid-label">Invoice</div>
            <div class="grid-content">
              ${new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}<br>
              Order #${p.razorpayOrderId}
            </div>

            <div class="grid-label">Client</div>
            <div class="grid-content">
              <div class="client-name">${companyName}</div>
              Company Email: ${companyEmail}<br>
              ${companyAddress}
            </div>

            <div class="grid-label">Transaction</div>
            <div class="grid-content">
              Payment ID: <strong>${p.razorpayPaymentId || 'N/A'}</strong><br>
              Method: <strong>Secured via Razorpay</strong><br>
              Date: <strong>${new Date(p.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 45%;">Description</th>
                <th style="width: 15%;">Days</th>
                <th style="width: 20%;">Rate / Day</th>
                <th style="width: 20%; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div class="item-desc">Subscription - DealVoice Business</div>
                  <span class="item-subtext">Subscription Period: ${new Date(p.fromDate).toLocaleDateString()} to ${new Date(p.toDate).toLocaleDateString()}</span>
                  <span class="item-subtext">Total User Capacity: ${p.teamSizeMax} Users</span>
                </td>
                <td>${days}</td>
                <td>₹${ratePerDay.toLocaleString()}</td>
                <td style="text-align: right; font-weight: 600;">₹${((p.subtotal || (p.amount / 1.18)) / 100).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary-container">
            <div class="summary-item">
              <div class="summary-label">Subtotal</div>
              <div class="summary-val">₹${((p.subtotal || (p.amount / 1.18)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Tax (18% GST)</div>
              <div class="summary-val">₹${((p.tax || (p.amount - (p.amount / 1.18))) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="summary-item" style="align-items: flex-end;">
              <div class="summary-label">Total Amount</div>
              <div class="grand-total">₹${(p.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div class="notes">
            Please note that this is a system-generated invoice. For any queries regarding this payment or your subscription, feel free to reach out to our support team.
            Thank you for your confidence in DealVoice.
          </div>

          <div class="footer-brand">
            Softrate Technologies Private Limited.
          </div>
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
              setTimeout(() => window.close(), 500);
            }, 1000);
          };
        </script>
      </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
  }

  onLoginSubmit(event: Event): void {
    event.preventDefault();
    this.loginError = '';
    this.loginLoading = true;
    this.authService.login(this.loginForm).subscribe({
      next: (res) => {
        this.loginLoading = false;
        if (res.success && res.user) {
          this.closeModals();
          this.loggedIn = true;
          this.dashboardCompany = res.user.companyName || 'Your Company';
          this.dashboardCode = res.user.companyCode || 'N/A';
          this.dashboardTeamSize = parseInt(res.user.teamSize) || 0;
          localStorage.setItem('tracecall_user', JSON.stringify(res.user));
          setTimeout(() => window.scrollTo(0, 0), 0);
          this._loadDashboard();
        } else {
          this.loginError = res.message;
        }
      },
      error: (err) => {
        this.loginLoading = false;
        // Handle pending approval status
        if (err.status === 403) {
          this.loginError = err.error?.message || 'Account pending approval.';
        } else {
          this.loginError = err?.error?.message || 'Invalid credentials or server error.';
        }
      },
    });
  }

  goToLoginFromSuccess(): void { this.openLogin(); this.signupSuccess = false; }

  openLogoutConfirm(): void {
    this.isLogoutConfirmOpen = true;
  }

  closeLogoutConfirm(): void {
    this.isLogoutConfirmOpen = false;
  }

  logout(): void {
    this.loggedIn = false;
    this.dashboardCompany = '';
    this.dashboardCode = '';
    this.employees = [];
    this.summaryStats = null;
    this.selectedEmployee = null;
    this.isLogoutConfirmOpen = false;
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    if (this.donutChart) { this.donutChart.destroy(); this.donutChart = null; }
    localStorage.removeItem('tracecall_user');
    window.scrollTo(0, 0);
  }

  openAddEmployee(): void { this.isAddEmployeeOpen = true; this.addEmployeeError = ''; this.newEmployee = { name: '', mobile: '', countryCode: '+91' }; }
  closeAddEmployee(): void { this.isAddEmployeeOpen = false; }

  onAddEmployeeSubmit(event: Event): void {
    event.preventDefault();
    this.addEmployeeError = '';
    if (!this.newEmployee.name || !this.newEmployee.mobile) {
      this.addEmployeeError = 'Name and mobile are required.'; return;
    }
    if (this.dashboardTeamSize > 0 && this.employees.length >= this.dashboardTeamSize) {
      this.addEmployeeError = `Employee limit reached. Your current plan allows for a maximum of ${this.dashboardTeamSize} employees. Please update your team size in settings if you need to add more.`;
      return;
    }

    this.addEmployeeLoading = true;
    this.employeeService.addEmployee({ ...this.newEmployee, companyCode: this.dashboardCode }).subscribe({
      next: (res: any) => {
        this.addEmployeeLoading = false;
        if (res.success && res.employee) {
          this.employees.unshift(res.employee);
          this.closeAddEmployee();
          // Reload dashboard data so the new employee can show stats 
          this.fetchEmployeeCallRows(true);
        } else this.addEmployeeError = res.message || 'Failed to add employee.';
      },
      error: (err: any) => {
        this.addEmployeeLoading = false;
        this.addEmployeeError = err?.error?.message || 'Server error.';
      }
    });
  }

  // Edit Employee
  openEditEmployee(emp: Employee): void {
    this.editingEmployee = {
      _id: emp._id,
      name: emp.name,
      mobile: emp.mobile,
      countryCode: emp.countryCode || '+91',
      tags: emp.tags ? [...emp.tags] : []
    };
    this.isEditEmployeeOpen = true;
    this.editEmployeeError = '';
  }

  closeEditEmployee(): void {
    this.isEditEmployeeOpen = false;
    this.editEmployeeError = '';
  }

  onEditEmployeeSubmit(event: Event): void {
    event.preventDefault();
    if (!this.editingEmployee._id) return;
    this.editEmployeeLoading = true;
    this.editEmployeeError = '';

    this.employeeService.updateEmployee(this.editingEmployee._id, {
      name: this.editingEmployee.name,
      mobile: this.editingEmployee.mobile,
      countryCode: this.editingEmployee.countryCode,
      tags: this.editingEmployee.tags
    }).subscribe({
      next: (res: any) => {
        this.editEmployeeLoading = false;
        if (res.success) {
          this.fetchEmployees();
          this.closeEditEmployee();
        } else {
          this.editEmployeeError = res.message;
        }
      },
      error: (err: any) => {
        this.editEmployeeLoading = false;
        this.editEmployeeError = err?.error?.message || 'Error updating employee.';
      }
    });
  }

  toggleEditTag(tag: string): void {
    const idx = this.editingEmployee.tags.indexOf(tag);
    if (idx > -1) {
      this.editingEmployee.tags.splice(idx, 1);
    } else {
      this.editingEmployee.tags.push(tag);
    }
  }

  // ── Employee Tagging (Inline) ─────────────────────────────────

  enableTagEdit(emp: Employee): void {
    event?.stopPropagation(); // Prevent row click from showing drilldown
    this.editTagEmpId = emp._id!;
    this.inlineTagValue = (emp.tags && emp.tags.length > 0) ? emp.tags[0] : '';
  }

  cancelTagEdit(event: Event): void {
    event.stopPropagation();
    this.editTagEmpId = null;
    this.inlineTagValue = '';
    this.showInlineDropdown = null;
  }

  focusTagInput(emp: Employee): void {
    this.showInlineDropdown = emp._id!;
  }

  blurTagInput(): void {
    // Delay to allow dropdown click to register before hiding
    setTimeout(() => {
      this.showInlineDropdown = null;
    }, 200);
  }

  getFilteredTagOptions(): string[] {
    const val = (this.inlineTagValue || '').toLowerCase();
    return this.tagOptions.filter(t => t.toLowerCase().includes(val));
  }

  saveInlineTag(emp: Employee, event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.dashboardCode) return;

    const finalTag = this.inlineTagValue.trim();
    if (!finalTag) {
      alert('Please enter a tag name to save.');
      return;
    }

    this.savingTag = true;
    const tagsToSave = [finalTag];

    this.employeeService.updateEmployeeTags(emp._id!, tagsToSave, this.dashboardCode).subscribe({
      next: (res: any) => {
        this.savingTag = false;
        if (res.success) {
          emp.tags = res.employee.tags;

          if (finalTag && !this.tagOptions.includes(finalTag)) {
            this.tagOptions.push(finalTag);
          }

          this.editTagEmpId = null;
        } else {
          alert('Failed to update tag: ' + (res.message || 'Unknown error'));
        }
      },
      error: (err: any) => {
        this.savingTag = false;
        alert('Server error updating tags.');
      }
    });
  }

  // ── Modals / Misc ────────────────────────────────────────

  openAllCallsModal(): void {
    this.showAllCallsModal = true;
  }

  closeAllCallsModal(): void {
    this.showAllCallsModal = false;
  }

  // ── Company & Password ────────────────────────────────────
  fetchCompanyProfile(): void {
    if (!this.dashboardCode) return;
    this.companyProfileLoading = true;
    this.authService.getCompanyProfile(this.dashboardCode).subscribe({
      next: (res: any) => {
        this.companyProfileLoading = false;
        if (res.success) {
          this.companyProfile = res.company;
          this.editAddressValue = res.company.companyAddress || '';
          this.tagOptions = res.company.tags || [];
          if (this.companyProfile.rmRequestTime) {
            this.startRmTimer(this.companyProfile.rmRequestTime);
          }
        }
      },
      error: () => { this.companyProfileLoading = false; }
    });
  }

  // ── Support & RM ──────────────────────────────────────────

  requestRm(): void {
    if (!this.dashboardCode) return;
    this.rmRequestLoading = true;
    this.rmRequestMessage = '';

    this.authService.requestRm(this.dashboardCode).subscribe({
      next: (res: any) => {
        this.rmRequestLoading = false;
        if (res.success) {
          this.rmRequestMessage = res.message;
          if (this.companyProfile) {
            this.companyProfile.rmRequestTime = res.rmRequestTime;
            this.startRmTimer(res.rmRequestTime);
          }
        }
      },
      error: (err: any) => {
        this.rmRequestLoading = false;
        this.rmRequestMessage = err?.error?.message || 'Error sending request.';
      }
    });
  }

  startRmTimer(requestTime: any): void {
    if (this.rmTimerInterval) clearInterval(this.rmTimerInterval);

    const update = () => {
      const start = new Date(requestTime).getTime();
      const end = start + (8 * 60 * 60 * 1000);
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        this.rmCountdown = '';
        clearInterval(this.rmTimerInterval);
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      this.rmCountdown = `${h}h ${m}m ${s}s`;
    };

    update();
    this.rmTimerInterval = setInterval(update, 1000);
  }

  assignAdminRm(): void {
    if (!this.dashboardCode) return;
    this.adminRmLoading = true;

    this.authService.assignRm(this.dashboardCode, this.adminRm).subscribe({
      next: (res: any) => {
        this.adminRmLoading = false;
        if (res.success) {
          if (this.companyProfile) {
            this.companyProfile.relationshipManager = res.company.relationshipManager;
          }
          alert('RM Assigned successfully!');
        }
      },
      error: () => {
        this.adminRmLoading = false;
        alert('Failed to assign RM.');
      }
    });
  }

  copyConnectCodeLink(): void {
    const link = `https://help.callyzer.co/article/how-to-register-your-emp/`;
    navigator.clipboard.writeText(link).then(() => {
      alert('Link copied to clipboard!');
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }

  // ── Tag Management logic ──
  addTag(): void {
    const tag = this.newTagInput.trim();
    if (!tag) return;
    if (this.tagOptions.includes(tag)) {
      this.tagManagementError = 'Tag already exists.';
      setTimeout(() => this.tagManagementError = '', 3000);
      return;
    }
    this.tagOptions.push(tag);
    this.newTagInput = '';
    this.persistCompanyTags();
  }

  removeTag(tag: string): void {
    this.tagOptions = this.tagOptions.filter(t => t !== tag);
    this.persistCompanyTags();
  }

  persistCompanyTags(): void {
    if (!this.dashboardCode) return;
    this.tagManagementLoading = true;
    this.tagManagementError = '';

    this.authService.updateCompanyTags(this.dashboardCode, this.tagOptions).subscribe({
      next: (res: any) => {
        this.tagManagementLoading = false;
        if (res.success) {
          this.tagOptions = res.tags;
          if (this.companyProfile) this.companyProfile.tags = res.tags;
          this.tagManagementSuccess = 'Tags updated!';
          setTimeout(() => this.tagManagementSuccess = '', 3000);
        } else {
          this.tagManagementError = res.message;
        }
      },
      error: (err: any) => {
        this.tagManagementLoading = false;
        this.tagManagementError = err?.error?.message || 'Error updating tags.';
      }
    });
  }

  openShareModal(): void {
    if (!this.companyProfile) return;
    const code = this.companyProfile.companyCode || 'N/A';
    const email = this.companyProfile.email || 'N/A';
    const mobile = this.companyProfile.mobile || 'N/A';

    this.shareMessage = `Hello,

To register your employee using Callyzer Biz mobile app, please follow the step-by-step instructions mentioned in the link below:
https://help.callyzer.co/article/how-to-register-your-employees

Please use below unique device connect code to register. Your Device Connect Code is ${code}.

If you encounter any difficulties, please contact at ${email} or ${mobile}

Thank You.`;
    this.showShareModal = true;
  }

  copyShareMessage(): void {
    navigator.clipboard.writeText(this.shareMessage).then(() => {
      alert('Message copied to clipboard!');
      this.showShareModal = false;
    });
  }

  startEditAddress(): void {
    this.editingAddress = true;
    this.editAddressValue = this.companyProfile?.companyAddress || '';
    this.saveAddressError = '';
    this.saveAddressSuccess = '';
  }

  cancelEditAddress(): void {
    this.editingAddress = false;
    this.saveAddressError = '';
  }

  saveAddress(): void {
    this.saveAddressLoading = true;
    this.saveAddressError = '';
    this.saveAddressSuccess = '';
    this.authService.updateAddress(this.dashboardCode, this.editAddressValue).subscribe({
      next: (res: any) => {
        this.saveAddressLoading = false;
        if (res.success) {
          this.companyProfile.companyAddress = res.companyAddress;
          const raw = localStorage.getItem('tracecall_user');
          if (raw) {
            try {
              const user = JSON.parse(raw);
              user.companyAddress = res.companyAddress;
              localStorage.setItem('tracecall_user', JSON.stringify(user));
            } catch { }
          }
          this.editingAddress = false;
          this.saveAddressSuccess = 'Address updated!';
          setTimeout(() => this.saveAddressSuccess = '', 3000);
        } else { this.saveAddressError = res.message; }
      },
      error: (err: any) => {
        this.saveAddressLoading = false;
        this.saveAddressError = err?.error?.message || 'Server error.';
      }
    });
  }

  startEditTeamSize(): void {
    this.editingTeamSize = true;
    this.editTeamSizeValue = this.companyProfile?.teamSize || '';
    this.saveTeamSizeError = '';
    this.saveTeamSizeSuccess = '';
  }

  cancelEditTeamSize(): void {
    this.editingTeamSize = false;
    this.saveTeamSizeError = '';
  }

  saveTeamSize(): void {
    if (!this.editTeamSizeValue || parseInt(this.editTeamSizeValue.toString()) < 1) {
      this.saveTeamSizeError = 'Please enter a valid team size (minimum 1).';
      return;
    }

    this.saveTeamSizeLoading = true;
    this.saveTeamSizeError = '';
    this.saveTeamSizeSuccess = '';
    this.authService.updateTeamSize(this.dashboardCode, this.editTeamSizeValue.toString()).subscribe({
      next: (res: any) => {
        this.saveTeamSizeLoading = false;
        if (res.success) {
          this.companyProfile.teamSize = res.teamSize;
          this.dashboardTeamSize = parseInt(res.teamSize);

          const raw = localStorage.getItem('tracecall_user');
          if (raw) {
            try {
              const user = JSON.parse(raw);
              user.teamSize = res.teamSize;
              localStorage.setItem('tracecall_user', JSON.stringify(user));
            } catch { }
          }

          this.editingTeamSize = false;
          this.saveTeamSizeSuccess = 'Team size updated!';
          setTimeout(() => this.saveTeamSizeSuccess = '', 3000);
        } else {
          this.saveTeamSizeError = res.message;
        }
      },
      error: (err: any) => {
        this.saveTeamSizeLoading = false;
        this.saveTeamSizeError = err?.error?.message || 'Server error.';
      }
    });
  }

  onChangePwdInput(value: string): void {
    this.changePwdForm.newPassword = value;
    this.changePwdChecks = {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      number: /[0-9]/.test(value),
      symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value),
    };
  }

  get changePwdStrong(): boolean { return Object.values(this.changePwdChecks).every(Boolean); }

  onChangePasswordSubmit(event: Event): void {
    event.preventDefault();
    this.changePwdError = '';
    this.changePwdSuccess = '';
    if (this.changePwdForm.newPassword !== this.changePwdForm.confirmPassword) {
      this.changePwdError = 'New passwords do not match.'; return;
    }
    if (!this.changePwdStrong) {
      this.changePwdError = 'New password does not meet strength requirements.'; return;
    }
    this.changePwdLoading = true;
    const p = { oldPassword: this.changePwdForm.oldPassword, newPassword: this.changePwdForm.newPassword };
    this.authService.changePassword(this.dashboardCode, p).subscribe({
      next: (res: any) => {
        this.changePwdLoading = false;
        if (res.success) {
          this.changePwdSuccess = 'Password updated successfully!';
          this.changePwdForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
          this.changePwdChecks = { length: false, upper: false, number: false, symbol: false };
        } else { this.changePwdError = res.message; }
      },
      error: (err: any) => {
        this.changePwdLoading = false;
        this.changePwdError = err?.error?.message || 'Server error.';
      }
    });
  }

  exportToExcel(): void {
    const data = this.filteredEmployeeCallRows.map((row, index) => {
      const obj: any = {
        'Sr. No.': index + 1,
        'Employee': `${row.emp.name} (${row.emp.mobile})`,
        'Total Calls': row.stats?.total || 0,
        'Total Duration': this.fmtDur(row.stats?.totalDuration || 0),
        'Connected Calls': row.stats?.connected || 0,
        'Conn. Calls Duration': this.fmtDur((row.stats?.incomingDuration || 0) + (row.stats?.outgoingDuration || 0)),
        'Conn. Call Avg. Duration': this.fmtAvgDur((row.stats?.incomingDuration || 0) + (row.stats?.outgoingDuration || 0), row.stats?.connected || 0),
        'Working Hours': this.fmtDur(row.stats?.totalDuration || 0),
        'Unique Clients': 0,
        'Unique Conn. Calls': 0
      };

      if (!this.filterCallType || this.filterCallType === 'Incoming') {
        obj['Incoming Total'] = row.stats?.incoming || 0;
        obj['Incoming Duration'] = this.fmtDur(row.stats?.incomingDuration || 0);
        obj['Incoming Connected'] = row.stats?.incomingConnected || 0;
      }

      if (!this.filterCallType || this.filterCallType === 'Outgoing') {
        obj['Outgoing Total'] = row.stats?.outgoing || 0;
        obj['Outgoing Duration'] = this.fmtDur(row.stats?.outgoingDuration || 0);
        obj['Outgoing Connected'] = row.stats?.outgoingConnected || 0;
      }

      if (!this.filterCallType || this.filterCallType === 'Missed') {
        obj['Missed Total'] = row.stats?.missed || 0;
      }

      if (!this.filterCallType || this.filterCallType === 'Rejected') {
        obj['Rejected Total'] = row.stats?.rejected || 0;
      }

      obj['Never Attended'] = 0;
      obj['Not Pickup by Client'] = 0;
      obj['Last Sync Time'] = row.emp.lastSyncTime ? new Date(row.emp.lastSyncTime).toLocaleString('en-IN') : 'Never';

      return obj;
    });

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee Summary');
    XLSX.writeFile(wb, `Employee_Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  resetFilters(): void {
    this.filterTags = '';
    this.filterEmployees = '';
    this.filterCallType = '';
    this.filterDuration = '';
    this.filterCallTime = '';
    this.excludePhoneNumbers = false;
    this.customFrom = new Date().toISOString().split('T')[0];
    this.customTo = new Date().toISOString().split('T')[0];
    this.selectedPeriod = 'custom';
    this.applyCustomRange();
  }
}