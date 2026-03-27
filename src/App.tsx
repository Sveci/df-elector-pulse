import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { TrackingProvider } from "./components/TrackingProvider";
import { TutorialProvider } from "./contexts/TutorialContext";
import { DemoModeProvider } from "./contexts/DemoModeContext";
import { DashboardLayout } from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageLoader } from "./components/PageLoader";
import { CoordinatorAuthProvider } from "./contexts/CoordinatorAuthContext";
import { DynamicMetaTags } from "./components/DynamicMetaTags";
import { PublicOpinionRealtimeProvider } from "./components/public-opinion/PublicOpinionRealtimeProvider";
import { CookieConsentBanner } from "./components/CookieConsentBanner";
import { TenantProvider } from "./contexts/TenantContext";
import { TenantSelectorModal } from "./components/TenantSelectorModal";
import type { AppRole } from "./hooks/useUserRole";

// ─── Lazy imports: each page is a separate chunk ────────────────────────────
// Public / auth pages (lightweight, load fast)
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const DemoLogin = lazy(() => import("./pages/DemoLogin"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ResetSuccess = lazy(() => import("./pages/ResetSuccess"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const LgpdCookies = lazy(() => import("./pages/LgpdCookies"));
const LgpdDireitos = lazy(() => import("./pages/LgpdDireitos"));
const SobreNos = lazy(() => import("./pages/SobreNos"));
const Contato = lazy(() => import("./pages/Contato"));
const CentralAjuda = lazy(() => import("./pages/CentralAjuda"));
const StatusSistema = lazy(() => import("./pages/StatusSistema"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Public functional pages
const LeaderRegistrationForm = lazy(() => import("./pages/LeaderRegistrationForm"));
const EventRegistration = lazy(() => import("./pages/EventRegistration"));
const EventRegistrationEmbed = lazy(() => import("./pages/EventRegistrationEmbed"));
const EventCheckin = lazy(() => import("./pages/EventCheckin"));
const LeadCaptureLanding = lazy(() => import("./pages/LeadCaptureLanding"));
const PublicLeaderRegistration = lazy(() => import("./pages/PublicLeaderRegistration"));
const AffiliateForm = lazy(() => import("./pages/AffiliateForm"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const SurveyPublicForm = lazy(() => import("./pages/SurveyPublicForm"));
const VerifyContact = lazy(() => import("./pages/VerifyContact"));
const VerifyLeader = lazy(() => import("./pages/VerifyLeader"));
const ShortUrlRedirect = lazy(() => import("./pages/ShortUrlRedirect"));
const MeetingPhotoUpload = lazy(() => import("./pages/MeetingPhotoUpload"));
const ScheduleVisit = lazy(() => import("./pages/ScheduleVisit"));
const SetupUsers = lazy(() => import("./pages/SetupUsers"));

// Coordinator portal
const CoordinatorLogin = lazy(() => import("./pages/coordinator/CoordinatorLogin"));
const CoordinatorDashboard = lazy(() => import("./pages/coordinator/CoordinatorDashboard"));
const CoordinatorEvents = lazy(() => import("./pages/coordinator/CoordinatorEvents"));
const CoordinatorMaterials = lazy(() => import("./pages/coordinator/CoordinatorMaterials"));
const CoordinatorVerifyLeader = lazy(() => import("./pages/coordinator/CoordinatorVerifyLeader"));

// Main app pages (heavy, split into separate chunks)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leaders = lazy(() => import("./pages/Leaders"));
const LeadersRanking = lazy(() => import("./pages/LeadersRanking"));
const LeaderTree = lazy(() => import("./pages/LeaderTree"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Events = lazy(() => import("./pages/Events"));
const Projects = lazy(() => import("./pages/Projects"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const Messaging = lazy(() => import("./pages/Messaging"));
const Segments = lazy(() => import("./pages/Segments"));
const AIAgent = lazy(() => import("./pages/AIAgent"));
const WhatsAppMarketing = lazy(() => import("./pages/WhatsAppMarketing"));
const WhatsAppHistory = lazy(() => import("./pages/WhatsAppHistory"));
const WhatsAppFlowBuilder = lazy(() => import("./pages/settings/whatsapp-flow/WhatsAppFlowBuilder"));

const EmailMarketing = lazy(() => import("./pages/EmailMarketing"));
const SMSMarketing = lazy(() => import("./pages/SMSMarketing"));
const ScheduledMessages = lazy(() => import("./pages/ScheduledMessages"));
const Surveys = lazy(() => import("./pages/Surveys"));
const SurveyEditor = lazy(() => import("./pages/SurveyEditor"));
const SurveyResults = lazy(() => import("./pages/SurveyResults"));
const StrategicMap = lazy(() => import("./pages/StrategicMap"));
const Materials = lazy(() => import("./pages/Materials"));
const InstagramFollowers = lazy(() => import("./pages/InstagramFollowers"));
const DownloadCoordinatorReport = lazy(() => import("./pages/DownloadCoordinatorReport"));
const DispatchRegionMaterials = lazy(() => import("./pages/DispatchRegionMaterials"));
const Proposicoes = lazy(() => import("./pages/Proposicoes"));

// Settings pages
const Settings = lazy(() => import("./pages/Settings"));
const AIProviders = lazy(() => import("./pages/settings/AIProviders"));
const TrackingSettings = lazy(() => import("./pages/settings/TrackingSettings"));
const AffiliateFormSettings = lazy(() => import("./pages/settings/AffiliateFormSettings"));
const Profile = lazy(() => import("./pages/settings/Profile"));
const Organization = lazy(() => import("./pages/settings/Organization"));
const Privacy = lazy(() => import("./pages/settings/Privacy"));
const Integrations = lazy(() => import("./pages/settings/Integrations"));
const Support = lazy(() => import("./pages/settings/Support"));
const AdminTickets = lazy(() => import("./pages/settings/AdminTickets"));
const Team = lazy(() => import("./pages/settings/Team"));
const LeaderFormSettings = lazy(() => import("./pages/settings/LeaderFormSettings"));
const Gamification = lazy(() => import("./pages/settings/Gamification"));
const WhatsAppChatbot = lazy(() => import("./pages/settings/WhatsAppChatbot"));
const Reports = lazy(() => import("./pages/settings/Reports"));
const RegionMaterials = lazy(() => import("./pages/settings/RegionMaterials"));
const BrainDashboard = lazy(() => import("./pages/settings/BrainDashboard"));
const DuplicateContacts = lazy(() => import("./pages/settings/DuplicateContacts"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminTenants = lazy(() => import("./pages/admin/AdminTenants"));
const AdminApis = lazy(() => import("./pages/admin/AdminApis"));
const AdminContatos = lazy(() => import("./pages/admin/AdminContatos"));
const AdminWebhookLogs = lazy(() => import("./pages/admin/AdminWebhookLogs"));

// Office module
const NewVisit = lazy(() => import("./pages/office/NewVisit"));
const Queue = lazy(() => import("./pages/office/Queue"));
const History = lazy(() => import("./pages/office/History"));
const OfficeSettings = lazy(() => import("./pages/office/Settings"));
const VisitCheckin = lazy(() => import("./pages/office/VisitCheckin"));
const Schedule = lazy(() => import("./pages/office/Schedule"));

// Public Opinion module
const PublicOpinionOverview = lazy(() => import("./pages/public-opinion/Overview"));
const PublicOpinionSentiment = lazy(() => import("./pages/public-opinion/SentimentAnalysis"));
const PublicOpinionTimeline = lazy(() => import("./pages/public-opinion/Timeline"));
const PublicOpinionComparison = lazy(() => import("./pages/public-opinion/Comparison"));
const PublicOpinionDemographics = lazy(() => import("./pages/public-opinion/Demographics"));
const PublicOpinionComments = lazy(() => import("./pages/public-opinion/Comments"));
const PublicOpinionInsights = lazy(() => import("./pages/public-opinion/Insights"));
const PublicOpinionEvents = lazy(() => import("./pages/public-opinion/AnalyzedEvents"));
const PublicOpinionReports = lazy(() => import("./pages/public-opinion/Reports"));
const PublicOpinionSettings = lazy(() => import("./pages/public-opinion/Settings"));

// ─── Scroll restoration on route change ─────────────────────────────────────
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
};

// ─── Helper: CadastroRedirect ────────────────────────────────────────────────
const CadastroRedirect = () => {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/+$/, "");
  if (pathname !== "/cadastro") return null;
  return <Navigate to={`/lider/cadastro${location.search}`} replace />;
};

// ─── Helpers: route wrappers ─────────────────────────────────────────────────
/** Wraps a page in DashboardLayout + RoleProtectedRoute */
const RP = ({
  roles,
  children,
}: {
  roles: AppRole[];
  children: React.ReactNode;
}) => (
  <RoleProtectedRoute allowedRoles={roles}>
    <DashboardLayout>{children}</DashboardLayout>
  </RoleProtectedRoute>
);

/** Wraps a page in DashboardLayout + ProtectedRoute */
const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const ADMIN_ROLES: AppRole[] = ["super_admin", "admin"];
const ALL_ROLES: AppRole[] = ["super_admin", "admin", "atendente"];
const CHECKIN_ROLES: AppRole[] = [
  "super_admin",
  "admin",
  "atendente",
  "checkin_operator",
];

// ─── App ─────────────────────────────────────────────────────────────────────
const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TutorialProvider>
          <Toaster />
          <Sonner />
          <DynamicMetaTags />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <ScrollToTop />
            <CookieConsentBanner />
            <AuthProvider>
              <DemoModeProvider>
                <TenantProvider>
                  <TrackingProvider>
                    <TenantSelectorModal />
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        {/* ── Public: Landing & Auth ────────────────── */}
                        <Route path="/" element={<Index />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/demo" element={<DemoLogin />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/reset-success" element={<ResetSuccess />} />
                        <Route path="/termos-de-uso" element={<TermosDeUso />} />
                        <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
                        <Route path="/lgpd-cookies" element={<LgpdCookies />} />
                        <Route path="/lgpd-direitos" element={<LgpdDireitos />} />
                        <Route path="/sobre" element={<SobreNos />} />
                        <Route path="/contato" element={<Contato />} />
                        <Route path="/ajuda" element={<CentralAjuda />} />
                        <Route path="/status" element={<StatusSistema />} />

                        {/* ── Public: Functional ───────────────────── */}
                        <Route path="/visita-gabinete/:visitId" element={<ScheduleVisit />} />
                        <Route path="/affiliate/:leaderToken" element={<AffiliateForm />} />
                        <Route path="/cadastro/*" element={<CadastroRedirect />} />
                        <Route path="/cadastro/:leaderToken" element={<LeaderRegistrationForm />} />
                        <Route path="/eventos/embed/:slug" element={<EventRegistrationEmbed />} />
                        <Route path="/eventos/:slug" element={<EventRegistration />} />
                        <Route path="/captacao/:slug" element={<LeadCaptureLanding />} />
                        <Route path="/lider/cadastro" element={<PublicLeaderRegistration />} />
                        <Route path="/descadastro" element={<Unsubscribe />} />
                        <Route path="/pesquisa/:slug" element={<SurveyPublicForm />} />
                        <Route path="/v/:codigo" element={<VerifyContact />} />
                        <Route path="/verificar-lider/:codigo" element={<VerifyLeader />} />
                        <Route path="/s/:code" element={<ShortUrlRedirect />} />
                        <Route path="/meeting-photo-upload/:token" element={<MeetingPhotoUpload />} />
                        <Route path="/checkin/:qrCode" element={<EventCheckin />} />

                        {/* ── Coordinator portal ────────────────────── */}
                        <Route
                          path="/coordenador/login"
                          element={<CoordinatorAuthProvider><CoordinatorLogin /></CoordinatorAuthProvider>}
                        />
                        <Route
                          path="/coordenador/dashboard"
                          element={<CoordinatorAuthProvider><CoordinatorDashboard /></CoordinatorAuthProvider>}
                        />
                        <Route
                          path="/coordenador/eventos"
                          element={<CoordinatorAuthProvider><CoordinatorEvents /></CoordinatorAuthProvider>}
                        />
                        <Route
                          path="/coordenador/materiais"
                          element={<CoordinatorAuthProvider><CoordinatorMaterials /></CoordinatorAuthProvider>}
                        />
                        <Route path="/coordenador/verificar" element={<CoordinatorVerifyLeader />} />

                        {/* ── Protected: office check-in ────────────── */}
                        <Route
                          path="/office/checkin/:qrCode"
                          element={<ProtectedRoute><VisitCheckin /></ProtectedRoute>}
                        />

                        {/* ── Setup (super_admin only) ──────────────── */}
                        <Route
                          path="/setup-users"
                          element={
                            <RoleProtectedRoute allowedRoles={["super_admin"]}>
                              <SetupUsers />
                            </RoleProtectedRoute>
                          }
                        />

                        {/* ── Main dashboard ────────────────────────── */}
                        <Route path="/dashboard" element={<RP roles={[...ALL_ROLES]}><Dashboard /></RP>} />

                        {/* ── Leaders ───────────────────────────────── */}
                        <Route path="/leaders" element={<RP roles={[...ALL_ROLES]}><Leaders /></RP>} />
                        <Route path="/leaders/ranking" element={<RP roles={[...ALL_ROLES]}><LeadersRanking /></RP>} />
                        <Route path="/leaders/tree" element={<RP roles={[...ALL_ROLES]}><LeaderTree /></RP>} />

                        {/* ── Contacts ──────────────────────────────── */}
                        <Route path="/contacts" element={<RP roles={[...ALL_ROLES]}><Contacts /></RP>} />

                        {/* ── Campaigns ─────────────────────────────── */}
                        <Route path="/campaigns" element={<RP roles={[...ALL_ROLES]}><Campaigns /></RP>} />

                        {/* ── Events ────────────────────────────────── */}
                        <Route path="/events" element={<RP roles={[...CHECKIN_ROLES]}><Events /></RP>} />

                        {/* ── Projects ──────────────────────────────── */}
                        <Route path="/projects" element={<RP roles={[...ALL_ROLES]}><Projects /></RP>} />

                        {/* ── Proposições Legislativas ──────────────── */}
                        <Route path="/proposicoes" element={<RP roles={[...ALL_ROLES]}><Proposicoes /></RP>} />

                        {/* ── Knowledge Base ────────────────────────── */}
                        <Route path="/knowledge-base" element={<RP roles={[...ADMIN_ROLES]}><KnowledgeBase /></RP>} />

                        {/* ── Surveys ───────────────────────────────── */}
                        <Route path="/surveys" element={<RP roles={[...ALL_ROLES]}><Surveys /></RP>} />
                        <Route path="/surveys/:id/edit" element={<RP roles={[...ALL_ROLES]}><SurveyEditor /></RP>} />
                        <Route path="/surveys/:id/results" element={<RP roles={[...ALL_ROLES]}><SurveyResults /></RP>} />

                        {/* ── AI Agent ──────────────────────────────── */}
                        <Route path="/ai-agent" element={<RP roles={[...ALL_ROLES]}><AIAgent /></RP>} />

                        {/* ── Communication ─────────────────────────── */}
                        <Route
                          path="/whatsapp"
                          element={
                            <RoleProtectedRoute allowedRoles={[...ALL_ROLES]}>
                              <WhatsAppMarketing />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/whatsapp/history"
                          element={
                            <RoleProtectedRoute allowedRoles={[...ALL_ROLES]}>
                              <DashboardLayout><WhatsAppHistory /></DashboardLayout>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/email"
                          element={
                            <RoleProtectedRoute allowedRoles={[...ALL_ROLES]}>
                              <EmailMarketing />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/sms"
                          element={
                            <RoleProtectedRoute allowedRoles={[...ALL_ROLES]}>
                              <SMSMarketing />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/scheduled"
                          element={
                            <RoleProtectedRoute allowedRoles={[...ALL_ROLES]}>
                              <ScheduledMessages />
                            </RoleProtectedRoute>
                          }
                        />

                        {/* ── Strategic Map ─────────────────────────── */}
                        <Route path="/strategic-map" element={<RP roles={[...ALL_ROLES]}><StrategicMap /></RP>} />

                        {/* ── Office module ─────────────────────────── */}
                        <Route
                          path="/office/schedule"
                          element={<RP roles={["super_admin"]}><Schedule /></RP>}
                        />
                        <Route path="/office/new" element={<RP roles={[...ALL_ROLES]}><NewVisit /></RP>} />
                        <Route path="/office/queue" element={<RP roles={[...ALL_ROLES]}><Queue /></RP>} />
                        <Route path="/office/history" element={<RP roles={[...ALL_ROLES]}><History /></RP>} />
                        <Route path="/office/settings" element={<RP roles={[...ADMIN_ROLES]}><OfficeSettings /></RP>} />

                        {/* ── Reports & Materials ───────────────────── */}
                        <Route
                          path="/disparar-materiais"
                          element={<ProtectedRoute><DashboardLayout><DispatchRegionMaterials /></DashboardLayout></ProtectedRoute>}
                        />
                        <Route
                          path="/relatorio-coordenadores"
                          element={<ProtectedRoute><DownloadCoordinatorReport /></ProtectedRoute>}
                        />
                        <Route path="/materials" element={<RP roles={["super_admin"]}><Materials /></RP>} />
                        <Route path="/instagram-followers" element={<RP roles={["super_admin"]}><InstagramFollowers /></RP>} />

                        {/* ── Settings ──────────────────────────────── */}
                        <Route path="/settings" element={<P><Settings /></P>} />
                        <Route path="/settings/ai-providers" element={<RP roles={[...ADMIN_ROLES]}><AIProviders /></RP>} />
                        <Route path="/settings/tracking" element={<RP roles={[...ADMIN_ROLES]}><TrackingSettings /></RP>} />
                        <Route
                          path="/settings/organization"
                          element={
                            <RoleProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
                              <Organization />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/integrations"
                          element={
                            <RoleProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
                              <Integrations />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route path="/settings/team" element={<RP roles={[...ADMIN_ROLES]}><Team /></RP>} />
                        <Route path="/settings/affiliate-form" element={<RP roles={[...ALL_ROLES]}><AffiliateFormSettings /></RP>} />
                        <Route path="/settings/leader-form" element={<RP roles={[...ALL_ROLES]}><LeaderFormSettings /></RP>} />
                        <Route path="/settings/gamification" element={<RP roles={[...ADMIN_ROLES]}><Gamification /></RP>} />
                        <Route path="/settings/whatsapp-chatbot" element={<RP roles={[...ADMIN_ROLES]}><WhatsAppChatbot /></RP>} />
                        <Route path="/settings/whatsapp-flow-builder" element={<RP roles={[...ADMIN_ROLES]}><WhatsAppFlowBuilder /></RP>} />
                        <Route path="/settings/region-materials" element={<RP roles={[...ADMIN_ROLES]}><RegionMaterials /></RP>} />
                        <Route path="/settings/brain" element={<RP roles={[...ADMIN_ROLES]}><BrainDashboard /></RP>} />
                        <Route path="/settings/reports" element={<RP roles={[...ALL_ROLES]}><Reports /></RP>} />
                        <Route path="/settings/duplicates" element={<RP roles={[...ADMIN_ROLES]}><DuplicateContacts /></RP>} />
                        <Route
                          path="/settings/profile"
                          element={<ProtectedRoute><Profile /></ProtectedRoute>}
                        />
                        <Route
                          path="/settings/privacy"
                          element={<ProtectedRoute><Privacy /></ProtectedRoute>}
                        />
                        <Route
                          path="/settings/support"
                          element={<ProtectedRoute><Support /></ProtectedRoute>}
                        />
                        {/* Redirect legacy route */}
                        <Route path="/settings/admin-tickets" element={<Navigate to="/admin/tickets" replace />} />

                        {/* ── Admin panel ───────────────────────────── */}
                        <Route path="/admin" element={<RoleProtectedRoute allowedRoles={["super_admin"]}><AdminDashboard /></RoleProtectedRoute>} />
                        <Route path="/admin/tickets" element={<RoleProtectedRoute allowedRoles={["super_admin"]}><AdminTickets /></RoleProtectedRoute>} />
                        <Route path="/admin/tenants" element={<RoleProtectedRoute allowedRoles={["super_admin"]}><AdminTenants /></RoleProtectedRoute>} />
                        <Route path="/admin/apis" element={<RoleProtectedRoute allowedRoles={["super_admin"]}><AdminApis /></RoleProtectedRoute>} />
                        <Route path="/admin/contatos" element={<RoleProtectedRoute allowedRoles={["super_admin"]}><AdminContatos /></RoleProtectedRoute>} />
                        <Route path="/admin/webhook-logs" element={<RoleProtectedRoute allowedRoles={["super_admin"]}><AdminWebhookLogs /></RoleProtectedRoute>} />

                        {/* ── Public Opinion (super_admin) ──────────── */}
                        <Route
                          path="/public-opinion"
                          element={
                            <RoleProtectedRoute allowedRoles={["super_admin"]}>
                              <DashboardLayout>
                                <PublicOpinionRealtimeProvider>
                                  <PublicOpinionOverview />
                                </PublicOpinionRealtimeProvider>
                              </DashboardLayout>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/public-opinion/sentiment"
                          element={
                            <RoleProtectedRoute allowedRoles={["super_admin"]}>
                              <DashboardLayout>
                                <PublicOpinionRealtimeProvider>
                                  <PublicOpinionSentiment />
                                </PublicOpinionRealtimeProvider>
                              </DashboardLayout>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/public-opinion/timeline"
                          element={
                            <RoleProtectedRoute allowedRoles={["super_admin"]}>
                              <DashboardLayout>
                                <PublicOpinionRealtimeProvider>
                                  <PublicOpinionTimeline />
                                </PublicOpinionRealtimeProvider>
                              </DashboardLayout>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/public-opinion/comparison"
                          element={
                            <RoleProtectedRoute allowedRoles={["super_admin"]}>
                              <DashboardLayout>
                                <PublicOpinionRealtimeProvider>
                                  <PublicOpinionComparison />
                                </PublicOpinionRealtimeProvider>
                              </DashboardLayout>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/public-opinion/demographics"
                          element={
                            <RoleProtectedRoute allowedRoles={["super_admin"]}>
                              <DashboardLayout>
                                <PublicOpinionRealtimeProvider>
                                  <PublicOpinionDemographics />
                                </PublicOpinionRealtimeProvider>
                              </DashboardLayout>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/public-opinion/comments"
                          element={
                            <RoleProtectedRoute allowedRoles={["super_admin"]}>
                              <DashboardLayout>
                                <PublicOpinionRealtimeProvider>
                                  <PublicOpinionComments />
                                </PublicOpinionRealtimeProvider>
                              </DashboardLayout>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/public-opinion/insights"
                          element={
                            <RoleProtectedRoute allowedRoles={["super_admin"]}>
                              <DashboardLayout>
                                <PublicOpinionRealtimeProvider>
                                  <PublicOpinionInsights />
                                </PublicOpinionRealtimeProvider>
                              </DashboardLayout>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/public-opinion/events"
                          element={
                            <RoleProtectedRoute allowedRoles={["super_admin"]}>
                              <DashboardLayout>
                                <PublicOpinionRealtimeProvider>
                                  <PublicOpinionEvents />
                                </PublicOpinionRealtimeProvider>
                              </DashboardLayout>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/public-opinion/reports"
                          element={
                            <RoleProtectedRoute allowedRoles={["super_admin"]}>
                              <DashboardLayout>
                                <PublicOpinionRealtimeProvider>
                                  <PublicOpinionReports />
                                </PublicOpinionRealtimeProvider>
                              </DashboardLayout>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/public-opinion/settings"
                          element={
                            <RoleProtectedRoute allowedRoles={["super_admin"]}>
                              <DashboardLayout>
                                <PublicOpinionRealtimeProvider>
                                  <PublicOpinionSettings />
                                </PublicOpinionRealtimeProvider>
                              </DashboardLayout>
                            </RoleProtectedRoute>
                          }
                        />

                        {/* ── 404 ──────────────────────────────────── */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </TrackingProvider>
                </TenantProvider>
              </DemoModeProvider>
            </AuthProvider>
          </BrowserRouter>
        </TutorialProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
