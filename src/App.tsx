import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { TrackingProvider } from "./components/TrackingProvider";
import { TutorialProvider } from "./contexts/TutorialContext";
import { DemoModeProvider } from "./contexts/DemoModeContext";
import { DashboardLayout } from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import DemoLogin from "./pages/DemoLogin";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ResetSuccess from "./pages/ResetSuccess";
import Dashboard from "./pages/Dashboard";
import Leaders from "./pages/Leaders";
import LeadersRanking from "./pages/LeadersRanking";
import Contacts from "./pages/Contacts";
import Campaigns from "./pages/Campaigns";
import Events from "./pages/Events";
import Projects from "./pages/Projects";
import Messaging from "./pages/Messaging";
import Segments from "./pages/Segments";
import AIAgent from "./pages/AIAgent";
import WhatsAppMarketing from "./pages/WhatsAppMarketing";
import EmailMarketing from "./pages/EmailMarketing";
import SMSMarketing from "./pages/SMSMarketing";
import ScheduledMessages from "./pages/ScheduledMessages";
import Settings from "./pages/Settings";
import AIProviders from "./pages/settings/AIProviders";
import ExternalSecrets from "./pages/settings/ExternalSecrets";
import TrackingSettings from "./pages/settings/TrackingSettings";
import AffiliateFormSettings from "./pages/settings/AffiliateFormSettings";
import Profile from "./pages/settings/Profile";
import Organization from "./pages/settings/Organization";
import Privacy from "./pages/settings/Privacy";
import Integrations from "./pages/settings/Integrations";
import Support from "./pages/settings/Support";
import AdminTickets from "./pages/settings/AdminTickets";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTenants from "./pages/admin/AdminTenants";
import Team from "./pages/settings/Team";
import SetupUsers from "./pages/SetupUsers";
import LeaderRegistrationForm from "./pages/LeaderRegistrationForm";
import NotFound from "./pages/NotFound";
import EventRegistration from "./pages/EventRegistration";
import EventCheckin from "./pages/EventCheckin";
import LeadCaptureLanding from "./pages/LeadCaptureLanding";
import PublicLeaderRegistration from "./pages/PublicLeaderRegistration";
import LeaderFormSettings from "./pages/settings/LeaderFormSettings";
import Gamification from "./pages/settings/Gamification";
import WhatsAppChatbot from "./pages/settings/WhatsAppChatbot";
import Reports from "./pages/settings/Reports";
import RegionMaterials from "./pages/settings/RegionMaterials";
import DuplicateContacts from "./pages/settings/DuplicateContacts";
import DispatchRegionMaterials from "./pages/DispatchRegionMaterials";
import DownloadCoordinatorReport from "./pages/DownloadCoordinatorReport";

// Office module pages
import NewVisit from "./pages/office/NewVisit";
import Queue from "./pages/office/Queue";
import History from "./pages/office/History";
import OfficeSettings from "./pages/office/Settings";
import VisitCheckin from "./pages/office/VisitCheckin";
import Schedule from "./pages/office/Schedule";
import ScheduleVisit from "./pages/ScheduleVisit";
import AffiliateForm from "./pages/AffiliateForm";
import Unsubscribe from "./pages/Unsubscribe";
import StrategicMap from "./pages/StrategicMap";
import Surveys from "./pages/Surveys";
import SurveyEditor from "./pages/SurveyEditor";
import SurveyResults from "./pages/SurveyResults";
import SurveyPublicForm from "./pages/SurveyPublicForm";
import VerifyContact from "./pages/VerifyContact";
import VerifyLeader from "./pages/VerifyLeader";
import LeaderTree from "./pages/LeaderTree";
import ShortUrlRedirect from "./pages/ShortUrlRedirect";
import CoordinatorLogin from "./pages/coordinator/CoordinatorLogin";
import CoordinatorDashboard from "./pages/coordinator/CoordinatorDashboard";
import CoordinatorEvents from "./pages/coordinator/CoordinatorEvents";
import CoordinatorMaterials from "./pages/coordinator/CoordinatorMaterials";
import CoordinatorVerifyLeader from "./pages/coordinator/CoordinatorVerifyLeader";
import { CoordinatorAuthProvider } from "./contexts/CoordinatorAuthContext";
import { DynamicMetaTags } from "./components/DynamicMetaTags";

// Public Opinion module
import { PublicOpinionRealtimeProvider } from "./components/public-opinion/PublicOpinionRealtimeProvider";
import Materials from "./pages/Materials";
import InstagramFollowers from "./pages/InstagramFollowers";
import PublicOpinionOverview from "./pages/public-opinion/Overview";
import PublicOpinionSentiment from "./pages/public-opinion/SentimentAnalysis";
import PublicOpinionTimeline from "./pages/public-opinion/Timeline";
import PublicOpinionComparison from "./pages/public-opinion/Comparison";
import PublicOpinionDemographics from "./pages/public-opinion/Demographics";
import PublicOpinionComments from "./pages/public-opinion/Comments";
import PublicOpinionInsights from "./pages/public-opinion/Insights";
import PublicOpinionEvents from "./pages/public-opinion/AnalyzedEvents";
import PublicOpinionReports from "./pages/public-opinion/Reports";
import PublicOpinionSettings from "./pages/public-opinion/Settings";

const queryClient = new QueryClient();

const CadastroRedirect = () => {
  const location = useLocation();

  // Suporta variações comuns como "/cadastro/" (barra final)
  // e garante que preservamos parâmetros UTM.
  const pathname = location.pathname.replace(/\/+$/, "");
  if (pathname !== "/cadastro") {
    // Se por algum motivo cair aqui com subrota, não força redirect.
    return null;
  }

  return <Navigate to={`/lider/cadastro${location.search}`} replace />;
};

const App = () => (
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
          <TrackingProvider>
          <AuthProvider>
          <DemoModeProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/demo" element={<DemoLogin />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset-success" element={<ResetSuccess />} />
            <Route path="/setup-users" element={<SetupUsers />} />
            
            {/* Public routes */}
            <Route path="/visita-gabinete/:visitId" element={<ScheduleVisit />} />
            <Route path="/affiliate/:leaderToken" element={<AffiliateForm />} />
            <Route path="/cadastro/*" element={<CadastroRedirect />} />
            <Route path="/cadastro/:leaderToken" element={<LeaderRegistrationForm />} />
            <Route path="/eventos/:slug" element={<EventRegistration />} />
            <Route path="/captacao/:slug" element={<LeadCaptureLanding />} />
            <Route path="/lider/cadastro" element={<PublicLeaderRegistration />} />
            <Route path="/descadastro" element={<Unsubscribe />} />
            <Route path="/pesquisa/:slug" element={<SurveyPublicForm />} />
            <Route path="/v/:codigo" element={<VerifyContact />} />
            <Route path="/verificar-lider/:codigo" element={<VerifyLeader />} />
            <Route path="/s/:code" element={<ShortUrlRedirect />} />
            
            {/* Coordinator Portal (public, own auth) */}
            <Route path="/coordenador/login" element={<CoordinatorAuthProvider><CoordinatorLogin /></CoordinatorAuthProvider>} />
            <Route path="/coordenador/dashboard" element={<CoordinatorAuthProvider><CoordinatorDashboard /></CoordinatorAuthProvider>} />
            <Route path="/coordenador/eventos" element={<CoordinatorAuthProvider><CoordinatorEvents /></CoordinatorAuthProvider>} />
            <Route path="/coordenador/materiais" element={<CoordinatorAuthProvider><CoordinatorMaterials /></CoordinatorAuthProvider>} />
            <Route path="/coordenador/verificar" element={<CoordinatorVerifyLeader />} />
            
            {/* Public check-in route with PIN protection */}
            <Route path="/checkin/:qrCode" element={<EventCheckin />} />
            <Route path="/office/checkin/:qrCode" element={
              <ProtectedRoute>
                <VisitCheckin />
              </ProtectedRoute>
            } />
            
            {/* Dashboard - admin e atendente */}
            <Route path="/dashboard" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Leaders - admin e atendente */}
            <Route path="/leaders" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <Leaders />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/leaders/ranking" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <LeadersRanking />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Leader Tree - admin, atendente e super_admin */}
            <Route path="/leaders/tree" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <LeaderTree />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Contacts - admin e atendente */}
            <Route path="/contacts" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <Contacts />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Campaigns - admin e atendente */}
            <Route path="/campaigns" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <Campaigns />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Events - admin, atendente e checkin_operator */}
            <Route path="/events" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente', 'checkin_operator']}>
                <DashboardLayout>
                  <Events />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Projects - admin e atendente */}
            <Route path="/projects" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <Projects />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Surveys - admin e atendente */}
            <Route path="/surveys" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <Surveys />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/surveys/:id/edit" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <SurveyEditor />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/surveys/:id/results" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <SurveyResults />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* AI Agent - admin e atendente */}
            <Route path="/ai-agent" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <AIAgent />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* WhatsApp - admin e atendente */}
            <Route path="/whatsapp" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <WhatsAppMarketing />
              </RoleProtectedRoute>
            } />
            
            {/* Email - admin e atendente */}
            <Route path="/email" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <EmailMarketing />
              </RoleProtectedRoute>
            } />
            
            {/* SMS - admin e atendente */}
            <Route path="/sms" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <SMSMarketing />
              </RoleProtectedRoute>
            } />
            
            {/* Scheduled Messages - admin e atendente */}
            <Route path="/scheduled" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <ScheduledMessages />
              </RoleProtectedRoute>
            } />
            
            {/* Settings - todos os roles autenticados */}
            <Route path="/settings" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Settings />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            
            {/* Settings - apenas admin */}
            <Route path="/settings/ai-providers" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <DashboardLayout>
                  <AIProviders />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/settings/external-secrets" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout>
                  <ExternalSecrets />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/settings/tracking" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <DashboardLayout>
                  <TrackingSettings />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/settings/organization" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <Organization />
              </RoleProtectedRoute>
            } />
            <Route path="/settings/integrations" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <Integrations />
              </RoleProtectedRoute>
            } />
            <Route path="/settings/team" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <DashboardLayout>
                  <Team />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Settings - admin e atendente */}
            <Route path="/settings/affiliate-form" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <AffiliateFormSettings />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/settings/leader-form" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <LeaderFormSettings />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/settings/gamification" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <DashboardLayout>
                  <Gamification />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/settings/whatsapp-chatbot" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <DashboardLayout>
                  <WhatsAppChatbot />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/settings/region-materials" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <DashboardLayout>
                  <RegionMaterials />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Settings - todos */}
            <Route path="/settings/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/settings/privacy" element={
              <ProtectedRoute>
                <Privacy />
              </ProtectedRoute>
            } />
            <Route path="/settings/support" element={
              <ProtectedRoute>
                <Support />
              </ProtectedRoute>
            } />
            
            {/* Reports - admin e atendente */}
            <Route path="/settings/reports" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <Reports />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Admin Tickets - redirect antigo para nova rota */}
            <Route path="/settings/admin-tickets" element={
              <Navigate to="/admin/tickets" replace />
            } />
            
            {/* Admin Panel - apenas super_admin */}
            <Route path="/admin" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <AdminDashboard />
              </RoleProtectedRoute>
            } />
            <Route path="/admin/tickets" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <AdminTickets />
              </RoleProtectedRoute>
            } />
            <Route path="/admin/tenants" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <AdminTenants />
              </RoleProtectedRoute>
            } />
            
            {/* Strategic Map - admin, super_admin e atendente */}
            <Route path="/strategic-map" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <StrategicMap />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Office module routes - admin e atendente */}
            <Route path="/office/schedule" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout>
                  <Schedule />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/office/new" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <NewVisit />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/office/queue" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <Queue />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/office/history" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'atendente']}>
                <DashboardLayout>
                  <History />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/office/settings" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <DashboardLayout>
                  <OfficeSettings />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            {/* Dispatch Region Materials */}
            <Route path="/disparar-materiais" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <DispatchRegionMaterials />
                </DashboardLayout>
              </ProtectedRoute>
            } />

            {/* Download Coordinator Report */}
            <Route path="/relatorio-coordenadores" element={
              <ProtectedRoute>
                <DownloadCoordinatorReport />
              </ProtectedRoute>
            } />
            
            {/* Duplicate Contacts */}
            <Route path="/settings/duplicates" element={
              <RoleProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <DashboardLayout>
                  <DuplicateContacts />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />
            
            
            {/* Public Opinion module - super_admin only — Realtime ativo em todas as rotas */}
            <Route path="/public-opinion" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout><PublicOpinionRealtimeProvider><PublicOpinionOverview /></PublicOpinionRealtimeProvider></DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/public-opinion/sentiment" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout><PublicOpinionRealtimeProvider><PublicOpinionSentiment /></PublicOpinionRealtimeProvider></DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/public-opinion/timeline" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout><PublicOpinionRealtimeProvider><PublicOpinionTimeline /></PublicOpinionRealtimeProvider></DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/public-opinion/comparison" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout><PublicOpinionRealtimeProvider><PublicOpinionComparison /></PublicOpinionRealtimeProvider></DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/public-opinion/demographics" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout><PublicOpinionRealtimeProvider><PublicOpinionDemographics /></PublicOpinionRealtimeProvider></DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/public-opinion/comments" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout><PublicOpinionRealtimeProvider><PublicOpinionComments /></PublicOpinionRealtimeProvider></DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/public-opinion/insights" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout><PublicOpinionRealtimeProvider><PublicOpinionInsights /></PublicOpinionRealtimeProvider></DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/public-opinion/events" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout><PublicOpinionRealtimeProvider><PublicOpinionEvents /></PublicOpinionRealtimeProvider></DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/public-opinion/reports" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout><PublicOpinionRealtimeProvider><PublicOpinionReports /></PublicOpinionRealtimeProvider></DashboardLayout>
              </RoleProtectedRoute>
            } />
            <Route path="/public-opinion/settings" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout><PublicOpinionRealtimeProvider><PublicOpinionSettings /></PublicOpinionRealtimeProvider></DashboardLayout>
              </RoleProtectedRoute>
            } />

            {/* Materials - super_admin only */}
            <Route path="/materials" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout>
                  <Materials />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />

            {/* Instagram Followers - super_admin only */}
            <Route path="/instagram-followers" element={
              <RoleProtectedRoute allowedRoles={['super_admin']}>
                <DashboardLayout>
                  <InstagramFollowers />
                </DashboardLayout>
              </RoleProtectedRoute>
            } />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DemoModeProvider>
        </AuthProvider>
        </TrackingProvider>
          </BrowserRouter>
      </TutorialProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
