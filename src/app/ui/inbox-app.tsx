"use client";

import { upload } from "@vercel/blob/client";
import {
  AlertCircle,
  BarChart3,
  BellRing,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  CircleUserRound,
  Clock3,
  Calendar,
  ClipboardList,
  FilePenLine,
  FileText,
  Filter,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  MessageCircleMore,
  Mic,
  MoreVertical,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  CircleHelp,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  SendHorizonal,
  Square,
  Star,
  Tags,
  Timer,
  Trash2,
  Truck,
  UserCheck,
  UserPlus,
  UsersRound,
  X
} from "lucide-react";
import { CSSProperties, DragEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TransportistaRow, LocalidadRow } from "@/lib/febecos";

// URL pública del selector — GET endpoints son públicos, CORS: *
const SELECTOR_API = "https://selector.febecos.com/api";

async function fetchTransportistas(provincia: string, localidad?: string): Promise<TransportistaRow[]> {
  const qs = new URLSearchParams({ provincia });
  if (localidad) qs.set("localidad", localidad);
  const r = await fetch(`${SELECTOR_API}/transportistas?${qs}`);
  if (!r.ok) throw new Error(`Error ${r.status}`);
  const d = await r.json() as { ok: boolean; rows?: TransportistaRow[]; error?: string };
  if (!d.ok) throw new Error(d.error ?? "Error desconocido");
  return d.rows ?? [];
}

async function fetchLocalidades(q: string, provincia?: string): Promise<LocalidadRow[]> {
  const qs = new URLSearchParams({ q });
  if (provincia) qs.set("provincia", provincia);
  const r = await fetch(`${SELECTOR_API}/localidades?${qs}`);
  if (!r.ok) throw new Error(`Error ${r.status}`);
  const d = await r.json() as { ok: boolean; localidades?: LocalidadRow[]; error?: string };
  return d.localidades ?? [];
}
import type {
  AppUser,
  ChannelAccount,
  ContactSummary,
  ConversationMessage,
  ConversationNote,
  ConversationEvent,
  AssignedFollowUpAlert,
  ConversationFollowUp,
  ConversationSummary,
  DashboardStats,
  LabelDefinition,
  MessageTemplate,
  TemplateAutomationRule,
  QuickReply,
  ScheduledTemplateMessage,
  UserAdminSummary
} from "@/lib/crm";

type Stats = DashboardStats;

type AppSetting = {
  key: string;
  value: unknown;
  label: string;
  description: string;
  updated_at: string;
};

type OutgoingWebhook = {
  id: string;
  name: string;
  url: string;
  has_secret: boolean;
  events: string[];
  active: boolean;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type OutgoingWebhookDelivery = {
  id: string;
  webhook_id: string | null;
  webhook_name: string | null;
  event: string;
  status: "pending" | "success" | "failed";
  response_status: number | null;
  response_body: string | null;
  error: string | null;
  created_at: string;
};

type ContactAdditionalInfo = {
  id: string;
  title: string;
  value: string;
};

type ChannelAccountForm = {
  id: string;
  slug: string;
  name: string;
  channel: "whatsapp" | "instagram" | "facebook" | "tiktok";
  externalAccountId: string;
  phoneNumber: string;
  provider: "cloud_api" | "qr_bridge";
  bridgeUrl: string;
  accessToken: string;
  bridgeToken: string;
  webhookToken: string;
  keepAccessToken: boolean;
  keepBridgeToken: boolean;
  keepWebhookToken: boolean;
  autoReplyEnabled: boolean;
  active: boolean;
};

type AgentTestResponse = {
  respuesta: string;
  segundoMensaje?: string | null;
  consultype: string;
  escalar: boolean;
};

type ToolKey = "conversations" | "metrics" | "contacts" | "crm" | "templates" | "labels" | "settings" | "users" | "ai" | "transportistas" | "aprendizajes";
type SettingKey =
  | "auto_reply_delay_seconds"
  | "hot_lead_default_assignee_id"
  | "notification_sound"
  | "notification_sound_users"
  | "whatsapp_selector_flow_id"
  | "whatsapp_selector_flow_screen"
  | "whatsapp_selector_flow_header"
  | "whatsapp_selector_flow_body"
  | "whatsapp_selector_flow_footer"
  | "whatsapp_selector_flow_cta";

type NotificationSoundName = "chime" | "ping" | "soft" | "alert" | "none";

type NotificationSoundConfig = {
  sound: NotificationSoundName;
  volume: number;
};

type UserNotificationSoundSetting = {
  mode: "default" | "custom";
  sound?: NotificationSoundName;
  volume?: number;
};

const DEFAULT_NOTIFICATION_SOUND_CONFIG: NotificationSoundConfig = {
  sound: "chime",
  volume: 0.55
};

const NOTIFICATION_SOUND_OPTIONS: Array<{ value: NotificationSoundName; label: string }> = [
  { value: "chime", label: "Campanita" },
  { value: "ping", label: "Ping corto" },
  { value: "soft", label: "Suave" },
  { value: "alert", label: "Alerta" },
  { value: "none", label: "Silencio" }
];

const CONSULTYPE_OPTIONS = [
  { value: "caliente", label: "Caliente" },
  { value: "comparador", label: "Comparador" },
  { value: "sin-perforacion", label: "Sin perforacion" },
  { value: "proyecto-futuro", label: "Proyecto futuro" },
  { value: "informacion", label: "Informacion" },
  { value: "seguimiento", label: "Seguimiento" },
  { value: "accion", label: "Accion" },
  { value: "otro", label: "Otro" }
];

const STATUS_OPTIONS = [
  { value: "open", label: "Abierta" },
  { value: "waiting", label: "Esperando" },
  { value: "quoted", label: "Cotizada" },
  { value: "hot", label: "Caliente" },
  { value: "handoff", label: "Humano" },
  { value: "closed", label: "Cerrada" },
  { value: "lost", label: "Perdida" }
];

const SENTIMENT_FILTERS = ["muy-negativo", "negativo", "neutro", "positivo", "muy-positivo"];
const TAG_FILTERS = [
  "caliente",
  "cliente",
  "comparador",
  "contacto-de-bobbio",
  "cotizado",
  "esperando-respuesta",
  "fuera-de-horario",
  "no-leido",
  "pasar-presupuesto",
  "pocero-instalador",
  "presupuesto-enviado"
];
const TEMPLATE_AUTOMATION_CONSULTYPES = [
  "caliente",
  "comparador",
  "sin-perforacion",
  "proyecto-futuro",
  "seguimiento",
  "informacion",
  "problema",
  "cotizado",
  "esperando-respuesta",
  "reserva-7-dias",
  "pasar-presupuesto",
  "presupuesto-enviado"
];
const DIRECT_ATTACHMENT_UPLOAD_LIMIT_BYTES = 3.8 * 1024 * 1024;
const BACKEND_ATTACHMENT_UPLOAD_LIMIT_BYTES = 16 * 1024 * 1024;
const CLIENT_DIRECT_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;
const MANUAL_REPLY_TIMEOUT_MS = 70000;
const MANUAL_BLOB_UPLOAD_TIMEOUT_MS = 25000;
const PCM_RECORDING_TARGET_SAMPLE_RATE = 16000;
const AUDIO_RECORDER_MODE_STORAGE_KEY = "febo-audio-recorder-mode";
type AudioRecorderMode = "auto" | "normal" | "compatible" | "very-compatible";
const OUTGOING_WEBHOOK_EVENTS = [
  { value: "selector_checkout_abierto", label: "Selector abierto" },
  { value: "lead_caliente", label: "Lead caliente" },
  { value: "asesor_asignado", label: "Asesor asignado" },
  { value: "chat_escalado", label: "Chat escalado" },
  { value: "mensaje_entrante", label: "Mensaje entrante" },
  { value: "mensaje_saliente", label: "Mensaje saliente" },
  { value: "nota_interna",    label: "Nota interna" },
  { value: "manual_selector_febecos", label: "Manual: Selector Febecos" },
  { value: "manual_purchase", label: "Manual: Purchase" },
  { value: "manual_lead", label: "Manual: Lead" },
  { value: "follow_up_proposed", label: "Seguimiento propuesto" },
  { value: "presupuesto_enviado", label: "Presupuesto enviado" },
  { value: "venta_cerrada", label: "Venta cerrada" },
  { value: "*", label: "Todos los eventos" }
];

const SIDEBAR_COLLAPSED_STORAGE_KEY = "febo-sidebar-collapsed";

export function InboxApp({
  conversations,
  currentUser,
  dbConfigured,
  stats,
  users,
  adminUsers
}: {
  conversations: ConversationSummary[];
  currentUser: AppUser | null;
  dbConfigured: boolean;
  stats: Stats;
  users: AppUser[];
  adminUsers: UserAdminSummary[];
}) {
  if (!currentUser) {
    return <LoginScreen dbConfigured={dbConfigured} />;
  }

  return (
    <main className="app-shell">
      <ToolWorkspace
        adminUsers={adminUsers}
        conversations={conversations}
        currentUser={currentUser}
        stats={stats}
        users={users}
      />
    </main>
  );
}

function LoginScreen({ dbConfigured }: { dbConfigured: boolean }) {
  const [email, setEmail] = useState("guille.aol@gmail.com");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code })
    });

    setLoading(false);

    if (!response.ok) {
      const payload = await readJsonResponse(response);
      setError(payload?.error ?? "No pudimos iniciar sesion.");
      return;
    }

    window.location.reload();
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <div className="login-brand">
          <Bot size={26} />
          <div>
            <h1>Febo AI</h1>
            <p>Acceso interno FEBECOS</p>
          </div>
        </div>

        {!dbConfigured ? (
          <div className="notice">Primero configuramos DATABASE_URL y corremos el schema de Neon.</div>
        ) : null}

        <label className="field">
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field">
          Codigo interno
          <input value={code} onChange={(event) => setCode(event.target.value)} type="password" />
        </label>
        <button className="primary" disabled={loading} type="submit">
          <UserCheck size={18} />
          {loading ? "Entrando" : "Entrar"}
        </button>
        {error ? <span className="warn">{error}</span> : null}
      </form>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric-card">
      <strong>{typeof value === "number" ? value.toLocaleString("es-AR") : value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ToolWorkspace({
  adminUsers,
  conversations,
  currentUser,
  stats,
  users
}: {
  adminUsers: UserAdminSummary[];
  conversations: ConversationSummary[];
  currentUser: AppUser;
  stats: Stats;
  users: AppUser[];
}) {
  const [activeTool, setActiveTool] = useState<ToolKey>("conversations");
  const [workspaceConversations, setWorkspaceConversations] = useState(conversations);
  const [labelDefinitions, setLabelDefinitions] = useState<LabelDefinition[]>([]);
  const [conversationLabelSlugs, setConversationLabelSlugs] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [conversationNavSignal, setConversationNavSignal] = useState(0);
  const [focusedConversation, setFocusedConversation] = useState({ id: "", signal: 0 });
  const [focusedContact, setFocusedContact] = useState({ id: "", signal: 0 });
  const [pushStatus, setPushStatus] = useState("Notificaciones");
  const [actionNotice, setActionNotice] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isAdmin = currentUser.role === "admin";
  const crmFavoritesStorageKey = `febo-crm-favorites:${currentUser.id}`;

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!actionNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setActionNotice(""), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [actionNotice]);

  // Deep-link: ?conv=UUID o ?phone=NUMERO abre la conversación (desde admin externo)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("conv");
    const phone  = params.get("phone");

    if (convId) {
      // Tenemos UUID directo → abrir esa conversación
      setActiveTool("conversations");
      setFocusedConversation({ id: convId, signal: Date.now() });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (phone) {
      // Solo teléfono → buscar la conversación en la lista cargada
      setActiveTool("conversations");
      const digits = phone.replace(/\D/g, "");
      // Buscar en workspaceConversations por sufijo de teléfono
      const found = workspaceConversations.find(c =>
        c.phone && c.phone.replace(/\D/g, "").endsWith(digits.slice(-8))
      );
      if (found) {
        setFocusedConversation({ id: found.id, signal: Date.now() });
      } else {
        // No está cargada aún — abrir búsqueda con el número
        const searchEl = document.querySelector<HTMLInputElement>(".inbox-search");
        if (searchEl) { searchEl.value = digits.slice(-10); searchEl.dispatchEvent(new Event("input")); }
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFavoritesLoaded(false);
    const storedFavorites =
      window.localStorage.getItem(crmFavoritesStorageKey) ?? window.localStorage.getItem("febo-crm-favorites");
    try {
      const parsedFavorites = storedFavorites ? JSON.parse(storedFavorites) : [];
      if (Array.isArray(parsedFavorites)) {
        setFavoriteIds(parsedFavorites.filter((id) => typeof id === "string"));
      }
    } catch {
      window.localStorage.removeItem(crmFavoritesStorageKey);
      setFavoriteIds([]);
    }
    setFavoritesLoaded(true);
  }, [crmFavoritesStorageKey]);

  useEffect(() => {
    if (!favoritesLoaded) {
      return;
    }

    window.localStorage.setItem(crmFavoritesStorageKey, JSON.stringify(favoriteIds));
  }, [crmFavoritesStorageKey, favoriteIds, favoritesLoaded]);

  useEffect(() => {
    void loadLabelDefinitions();
  }, []);

  async function loadLabelDefinitions() {
    const response = await fetch(currentUser.role === "admin" ? "/api/labels?all=1" : "/api/labels");
    const payload = await readJsonResponse(response);

    if (response.ok && Array.isArray(payload?.labels)) {
      setLabelDefinitions(payload.labels);
    }

    if (response.ok && Array.isArray(payload?.conversationLabels)) {
      setConversationLabelSlugs(
        payload.conversationLabels
          .map((label: { slug?: unknown }) => (typeof label.slug === "string" ? label.slug : ""))
          .filter(Boolean)
      );
    }
  }

  function toggleFavorite(conversationId: string) {
    setFavoriteIds((current) =>
      current.includes(conversationId) ? current.filter((id) => id !== conversationId) : [...current, conversationId]
    );
  }

  function setConversationFavorite(conversationId: string, active: boolean) {
    setFavoriteIds((current) => {
      if (active) {
        return current.includes(conversationId) ? current : [...current, conversationId];
      }

      return current.filter((id) => id !== conversationId);
    });
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <section className={`admin-workspace ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <nav className="tool-sidebar" aria-label="Herramientas de trabajo">
        <div className="tool-brand">
          <span aria-label="Febecos" className="brand-mark" role="img" />
          <strong>Febo AI</strong>
          <button
            className="sidebar-toggle"
            onClick={toggleSidebarCollapsed}
            title={sidebarCollapsed ? "Abrir menu" : "Contraer menu"}
            type="button"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <button
          className={activeTool === "conversations" ? "active" : ""}
          onClick={() => {
            setActiveTool("conversations");
            setConversationNavSignal((current) => current + 1);
          }}
          type="button"
        >
          <WhatsAppMark />
          Conversaciones
        </button>
        {isAdmin ? (
          <button
            className={activeTool === "metrics" ? "active" : ""}
            onClick={() => setActiveTool("metrics")}
            type="button"
          >
            <BarChart3 size={18} />
            M&eacute;tricas
          </button>
        ) : null}
        <button
          className={activeTool === "contacts" ? "active" : ""}
          onClick={() => setActiveTool("contacts")}
          type="button"
        >
          <UsersRound size={18} />
          Contactos
        </button>
        <button
          className={`mobile-hidden-tool ${activeTool === "crm" ? "active" : ""}`}
          onClick={() => setActiveTool("crm")}
          type="button"
        >
          <LayoutDashboard size={18} />
          Tablero CRM
        </button>
        <button
          className={activeTool === "templates" ? "active" : ""}
          onClick={() => setActiveTool("templates")}
          type="button"
        >
          <MessageSquareText size={18} />
          Seguimiento
        </button>
        <button
          className={activeTool === "labels" ? "active" : ""}
          onClick={() => setActiveTool("labels")}
          type="button"
        >
          <Tags size={18} />
          Etiquetas
        </button>
        <button className={activeTool === "ai" ? "active" : ""} onClick={() => setActiveTool("ai")} type="button">
          <Bot size={18} />
          Probar IA
        </button>
        <button className={activeTool === "transportistas" ? "active" : ""} onClick={() => setActiveTool("transportistas")} type="button">
          <Truck size={18} />
          Transportistas
        </button>
        {isAdmin ? (
          <>
            <button className={activeTool === "aprendizajes" ? "active" : ""} onClick={() => setActiveTool("aprendizajes")} type="button">
              <Bot size={18} />
              Aprendizajes IA
            </button>
            <button className={activeTool === "users" ? "active" : ""} onClick={() => setActiveTool("users")} type="button">
              <ShieldCheck size={18} />
              Usuarios y accesos
            </button>
            <button className={activeTool === "settings" ? "active" : ""} onClick={() => setActiveTool("settings")} type="button">
              <KeyRound size={18} />
              Configuracion
            </button>
          </>
        ) : null}
        <div className="tool-sidebar-bottom">
          <button onClick={() => hardRefreshApp()} title="Actualizar app" type="button">
            <RefreshCcw size={18} />
            Actualizar
          </button>
          <button
            onClick={() => void enablePushNotifications(setPushStatus, setActionNotice)}
            title={`Activar notificaciones - ${pushStatus}`}
            type="button"
          >
            <BellRing size={18} />
            {pushStatus}
          </button>
          <button onClick={logout} title="Salir" type="button">
            <LogOut size={18} />
            Salir
          </button>
        </div>
      </nav>
      {actionNotice ? <div className="app-action-notice">{actionNotice}</div> : null}

      <div className="tool-content">
        {activeTool === "conversations" ? (
          <InboxList
            conversations={workspaceConversations}
            currentUser={currentUser}
            favoriteIds={favoriteIds}
            labelDefinitions={labelDefinitions}
            onLabelsChange={setLabelDefinitions}
            onConversationsChange={setWorkspaceConversations}
            focusedConversation={focusedConversation}
            resetMobileDetailSignal={conversationNavSignal}
            onSetFavorite={setConversationFavorite}
            onToggleFavorite={toggleFavorite}
            users={users}
          />
        ) : null}
        {activeTool === "metrics" && isAdmin ? <MetricsPanel stats={stats} users={users} /> : null}
        {activeTool === "templates" ? <TemplatesPanel currentUser={currentUser} /> : null}
        {activeTool === "labels" ? (
          <LabelsPanel
            conversationLabelSlugs={[
              ...conversationLabelSlugs,
              ...workspaceConversations.map((conversation) => conversation.consultype).filter(Boolean)
            ]}
            currentUser={currentUser}
            labels={labelDefinitions}
            onLabelsChange={setLabelDefinitions}
          />
        ) : null}
        {activeTool === "contacts" ? (
          <ContactsPanel
            focusedContact={focusedContact}
            onContactCreated={(payload) => {
              setWorkspaceConversations(payload.conversations);
              setFocusedConversation({ id: payload.conversationId, signal: Date.now() });
              setActiveTool("conversations");
            }}
            onContactSaved={(contact) => {
              setWorkspaceConversations((current) =>
                current.map((conversation) =>
                  conversation.contact_id === contact.id
                    ? {
                        ...conversation,
                        assigned_name: contact.assigned_name,
                        assigned_to: contact.assigned_to,
                        consultype: contact.consultype,
                        display_name: contact.display_name,
                        phone: contact.phone,
                        sentiment: contact.sentiment
                      }
                    : conversation
                )
              );
            }}
            users={users}
          />
        ) : null}
        {activeTool === "crm" ? (
          <CrmBoardPanel
            conversations={workspaceConversations}
            currentUser={currentUser}
            favoriteIds={favoriteIds}
            onConversationsChange={setWorkspaceConversations}
            onToggleFavorite={toggleFavorite}
            onOpenChat={(conversationId) => {
              setFocusedConversation({ id: conversationId, signal: Date.now() });
              setActiveTool("conversations");
            }}
            onOpenContact={(contactId) => {
              setFocusedContact({ id: contactId, signal: Date.now() });
              setActiveTool("contacts");
            }}
          />
        ) : null}
        {activeTool === "users" && isAdmin ? (
          <AdminUsersPanel currentUser={currentUser} initialUsers={adminUsers} />
        ) : null}
        {activeTool === "settings" && isAdmin ? <SettingsPanel users={adminUsers.length ? adminUsers : users} /> : null}
        {activeTool === "ai" ? <AgentTester /> : null}
        {activeTool === "aprendizajes" && isAdmin ? <LearningsPanel /> : null}
        {activeTool === "transportistas" ? <TransportistasPanel /> : null}
      </div>
    </section>
  );
}

function WhatsAppMark() {
  return (
    <span aria-hidden="true" className="whatsapp-nav-mark">
      <MessageSquareText size={14} strokeWidth={2.7} />
    </span>
  );
}

function MetricsPanel({ stats, users }: { stats: Stats; users: AppUser[] }) {
  const [currentStats, setCurrentStats] = useState(stats);
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [startDate, setStartDate] = useState(() => toDateInputDaysAgo(29));
  const [endDate, setEndDate] = useState(() => toDateInputDaysAgo(0));
  const [assignedTo, setAssignedTo] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [notice, setNotice] = useState("");
  const totalPeriod = currentStats.inbound_7d + currentStats.outbound_7d;
  const aiShare = currentStats.outbound_7d ? Math.round((currentStats.ai_7d / currentStats.outbound_7d) * 100) : 0;
  const manualShare = currentStats.outbound_7d ? Math.round((currentStats.manual_7d / currentStats.outbound_7d) * 100) : 0;

  async function refreshMetrics(nextGroup = groupBy, nextStart = startDate, nextEnd = endDate, nextAssignedTo = assignedTo) {
    setLoading(true);
    setNotice("");
    try {
      const params = new URLSearchParams({
        groupBy: nextGroup,
        startDate: nextStart,
        endDate: nextEnd,
        assignedTo: nextAssignedTo
      });
      const response = await fetch(`/api/metrics?${params.toString()}`);
      const data = (await response.json()) as { stats?: Stats; error?: string };
      if (!response.ok || !data.stats) {
        throw new Error(data.error ?? "No pudimos actualizar las metricas.");
      }
      setCurrentStats(data.stats);
      setLoadedOnce(true);
      setNotice("Metricas actualizadas correctamente.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos actualizar las metricas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loadedOnce && !loading) {
      void refreshMetrics();
    }
  }, [loadedOnce, loading]);

  function applyQuickRange(days: number) {
    const nextStart = toDateInputDaysAgo(days - 1);
    const nextEnd = toDateInputDaysAgo(0);
    setStartDate(nextStart);
    setEndDate(nextEnd);
    void refreshMetrics(groupBy, nextStart, nextEnd);
  }

  function exportMetricsExcel() {
    const params = new URLSearchParams({
      groupBy,
      startDate,
      endDate,
      format: "xlsx"
    });
    if (assignedTo !== "all") {
      params.set("assignedTo", assignedTo);
    }
    window.location.href = `/api/metrics?${params.toString()}`;
  }

  async function copyMetricsApiLink() {
    const params = new URLSearchParams({
      groupBy,
      startDate,
      endDate
    });
    if (assignedTo !== "all") {
      params.set("assignedTo", assignedTo);
    }
    const apiPath = `/api/metrics?${params.toString()}`;
    const url = `${window.location.origin}${apiPath}`;

    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link JSON de metricas copiado.");
    } catch {
      setNotice(`Link JSON: ${url}`);
    }
  }

  return (
    <section className="metrics-panel">
      <div className="metrics-head">
        <p className="eyebrow">Panel de rendimiento</p>
        <h2>M&eacute;tricas avanzadas</h2>
        <p>Una vista unificada para seguir conversaciones, conversiones, fuentes de llegada y actividad comercial.</p>
      </div>
      <section className="metrics-controls">
        <label>
          Agrupar por
          <select
            value={groupBy}
            onChange={(event) => {
              const next = event.target.value as "day" | "week" | "month";
              setGroupBy(next);
              void refreshMetrics(next, startDate, endDate);
            }}
          >
            <option value="day">Por d&iacute;a</option>
            <option value="week">Por semana</option>
            <option value="month">Por mes</option>
          </select>
        </label>
        <label>
          Fecha inicio
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          Fecha fin
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <label>
          Vendedor
          <select
            value={assignedTo}
            onChange={(event) => {
              const next = event.target.value;
              setAssignedTo(next);
              void refreshMetrics(groupBy, startDate, endDate, next);
            }}
          >
            <option value="all">Todos</option>
            {users
              .filter((user) => user.role === "vendedor" || user.sales_group)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
          </select>
        </label>
        <button type="button" onClick={() => refreshMetrics()} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar panel"}
        </button>
        <button type="button" onClick={exportMetricsExcel}>
          Exportar Excel
        </button>
        <button type="button" onClick={copyMetricsApiLink}>
          Copiar link API
        </button>
        <div className="metrics-quick-ranges">
          <button type="button" onClick={() => applyQuickRange(7)}>7 d&iacute;as</button>
          <button type="button" onClick={() => applyQuickRange(30)}>30 d&iacute;as</button>
          <button type="button" onClick={() => applyQuickRange(90)}>90 d&iacute;as</button>
        </div>
        <p className={notice.includes("No pudimos") ? "metrics-alert error" : "metrics-alert"}>{notice || "Las metricas de adquisicion cuentan el primer contacto detectado dentro del rango."}</p>
      </section>
      <div className="metrics-grid">
        <Metric label="Conversaciones" value={currentStats.conversations} />
        <Metric label="Contactos" value={currentStats.contacts} />
        <Metric label="Prospectos" value={currentStats.prospects} />
        <Metric label="Clientes" value={currentStats.clients} />
        <Metric label="Conversi&oacute;n" value={`${currentStats.conversion_rate}%`} />
        <Metric label="Escaladas" value={currentStats.handoffs} />
        <Metric label="Calientes" value={currentStats.hot} />
        <Metric label="No le&iacute;das" value={currentStats.unread} />
      </div>
      <MetricInsightStrip stats={currentStats} />
      <OperationalSignalPanel stats={currentStats} />
      <div className="metrics-two-columns wide-left">
        <AcquisitionChart days={currentStats.acquisition_daily} groupBy={groupBy} />
        <SourceMetrics sources={currentStats.by_source} total={currentStats.contacts} />
      </div>
      <div className="metrics-grid compact">
        <Metric label="Entrantes 24h" value={currentStats.inbound_24h} />
        <Metric label="Salientes 24h" value={currentStats.outbound_24h} />
        <Metric label="IA activa" value={currentStats.ai_enabled} />
        <Metric label="Mensajes periodo" value={currentStats.messages_total} />
        <Metric label="Resp. prom." value={currentStats.avg_first_response_minutes === null ? "-" : `${currentStats.avg_first_response_minutes} min`} />
        <Metric label="Media periodo" value={currentStats.media_7d} />
        <Metric label="Plantillas enviadas" value={currentStats.templates_sent_7d} />
        <Metric label="Plantillas pendientes" value={currentStats.templates_pending} />
        <Metric label="Plantillas fallidas" value={currentStats.templates_failed_7d} />
        <Metric label="Seguimientos pendientes" value={currentStats.followups_pending} />
        <Metric label="Notas internas" value={currentStats.internal_notes_7d} />
        <Metric label="Actividad periodo" value={totalPeriod} />
      </div>
      <section className="metrics-section-title">
        <h3>Conversaci&oacute;n y operaci&oacute;n</h3>
        <p>Volumen reciente, mezcla IA/humanos, etiquetas y carga por vendedor.</p>
      </section>
      <div className="metrics-grid compact">
        <Metric label="Entrantes periodo" value={currentStats.inbound_7d} />
        <Metric label="Salientes periodo" value={currentStats.outbound_7d} />
        <Metric label="IA periodo" value={`${currentStats.ai_7d} (${aiShare}%)`} />
        <Metric label="Humanos periodo" value={`${currentStats.manual_7d} (${manualShare}%)`} />
        <Metric label="Reactivadas" value={`${currentStats.conversion.followups_reactivated} (${currentStats.conversion.followups_reactivation_rate}%)`} />
        <Metric label="Tiempo conv." value={currentStats.conversion.avg_conversion_days === null ? "-" : `${currentStats.conversion.avg_conversion_days} d&iacute;as`} />
      </div>
      <div className="metrics-two-columns">
        <MetricBreakdown title="Por etiqueta" items={currentStats.by_consultype} tone="multi" />
        <MetricBreakdown title="Por sentimiento" items={currentStats.by_sentiment} tone="sentiment" />
      </div>
      <div className="metrics-two-columns">
        <MetricBreakdown title="Por estado" items={currentStats.by_status} tone="status" />
        <MetricBreakdown title="Por canal" items={currentStats.by_channel} tone="channel" />
      </div>
      <div className="metrics-two-columns">
        <MetricBreakdown title="Por plataforma" items={currentStats.by_platform} tone="channel" />
        <SellerMetrics sellers={currentStats.by_seller} />
      </div>
      <DailyMetrics days={currentStats.daily} groupBy={groupBy} />
    </section>
  );
}

function OperationalSignalPanel({ stats }: { stats: Stats }) {
  const signals = [
    buildOperationalSignal({
      label: "No leidas",
      value: stats.unread,
      detail: "Conversaciones para revisar primero.",
      okLabel: "Bandeja al dia",
      warnAt: 5,
      dangerAt: 15
    }),
    buildOperationalSignal({
      label: "Calientes",
      value: stats.hot,
      detail: "Oportunidades que conviene cerrar o asignar.",
      okLabel: "Sin calientes pendientes",
      warnAt: 1,
      dangerAt: 8
    }),
    buildOperationalSignal({
      label: "Plantillas fallidas",
      value: stats.templates_failed_7d,
      detail: "Revisar token, variables o ventana de WhatsApp.",
      okLabel: "Plantillas OK",
      warnAt: 1,
      dangerAt: 3
    }),
    buildOperationalSignal({
      label: "Seguimientos",
      value: stats.followups_pending,
      detail: "Clientes para retomar antes de que se enfrien.",
      okLabel: "Sin seguimientos pendientes",
      warnAt: 5,
      dangerAt: 20
    })
  ];

  return (
    <section className="operational-signals" aria-label="Semaforo operativo">
      <div className="operational-signals-head">
        <h3>Semaforo operativo</h3>
        <p>Prioridades rapidas para mirar antes de entrar al detalle.</p>
      </div>
      <div className="operational-signal-grid">
        {signals.map((signal) => (
          <article className={`operational-signal ${signal.tone}`} key={signal.label}>
            <span>{signal.status}</span>
            <strong>{signal.value.toLocaleString("es-AR")}</strong>
            <div>
              <b>{signal.label}</b>
              <p>{signal.value > 0 ? signal.detail : signal.okLabel}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function buildOperationalSignal(input: {
  label: string;
  value: number;
  detail: string;
  okLabel: string;
  warnAt: number;
  dangerAt: number;
}) {
  const tone = input.value >= input.dangerAt ? "danger" : input.value >= input.warnAt ? "warn" : "ok";
  const status = tone === "danger" ? "Urgente" : tone === "warn" ? "Atencion" : "OK";

  return {
    ...input,
    status,
    tone
  };
}

function MetricInsightStrip({ stats }: { stats: Stats }) {
  const insights = [
    {
      label: "Calientes/contactos",
      value: percentage(stats.hot, stats.contacts),
      detail: `${stats.hot.toLocaleString("es-AR")} de ${stats.contacts.toLocaleString("es-AR")}`,
      tone: "hot"
    },
    {
      label: "Escaladas/convers.",
      value: percentage(stats.handoffs, stats.conversations),
      detail: `${stats.handoffs.toLocaleString("es-AR")} de ${stats.conversations.toLocaleString("es-AR")}`,
      tone: "handoff"
    },
    {
      label: "IA/salientes",
      value: percentage(stats.ai_7d, stats.outbound_7d),
      detail: `${stats.ai_7d.toLocaleString("es-AR")} de ${stats.outbound_7d.toLocaleString("es-AR")}`,
      tone: "ai"
    },
    {
      label: "Clientes/prospectos",
      value: percentage(stats.clients, stats.prospects + stats.clients),
      detail: `${stats.clients.toLocaleString("es-AR")} clientes`,
      tone: "client"
    }
  ];

  return (
    <section className="metrics-insights" aria-label="Lectura rapida de metricas">
      {insights.map((insight) => (
        <article className={`metrics-insight tone-${insight.tone}`} key={insight.label}>
          <div>
            <strong>{insight.value}%</strong>
            <span>{insight.label}</span>
          </div>
          <p>{insight.detail}</p>
          <i style={{ width: `${Math.max(4, insight.value)}%` }} />
        </article>
      ))}
    </section>
  );
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function AcquisitionChart({ days, groupBy }: { days: Stats["acquisition_daily"]; groupBy: "day" | "week" | "month" }) {
  const max = Math.max(...days.map((day) => day.selector + day.whatsapp + day.manual + day.other), 1);

  return (
    <section className="metric-section">
      <div className="metric-section-head">
        <h3>Adquisici&oacute;n y atribuci&oacute;n</h3>
        <span>{days.reduce((sum, day) => sum + day.selector + day.whatsapp + day.manual + day.other, 0).toLocaleString("es-AR")} primeros contactos</span>
      </div>
      <div className="acquisition-chart">
        {days.map((day) => {
          const total = day.selector + day.whatsapp + day.manual + day.other;
          return (
            <div className="acquisition-day" key={day.date} title={`${formatMetricDate(day.date, groupBy)} - ${total} contactos`}>
              <div className="acquisition-stack" style={{ height: `${Math.max(3, Math.round((total / max) * 100))}%` }}>
                <span className="source-selector" style={{ flex: day.selector || 0.001 }} />
                <span className="source-whatsapp" style={{ flex: day.whatsapp || 0.001 }} />
                <span className="source-manual" style={{ flex: day.manual || 0.001 }} />
                <span className="source-other" style={{ flex: day.other || 0.001 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="metric-legend">
        <span><i className="source-selector" /> Selector</span>
        <span><i className="source-whatsapp" /> WhatsApp</span>
        <span><i className="source-manual" /> Manual/importado</span>
        <span><i className="source-other" /> Otro</span>
      </div>
      <p className="metric-footnote">Se cuenta el primer contacto registrado. Si una fuente no trae tracking suficiente, queda como WhatsApp u otro origen.</p>
    </section>
  );
}

function SourceMetrics({ sources, total }: { sources: Stats["by_source"]; total: number }) {
  return (
    <section className="metric-section">
      <div className="metric-section-head">
        <h3>Canales de llegada</h3>
        <span>{sources.length} fuentes</span>
      </div>
      <div className="source-list">
        {sources.length ? sources.slice(0, 8).map((source) => (
          <article className="source-card" key={source.label}>
            <strong>{formatMetricLabel(source.label)}</strong>
            <b>{source.total.toLocaleString("es-AR")}</b>
            <div>
              <span>{source.hot} calientes</span>
              <span>{source.assigned} asignados</span>
              <span>{source.client} clientes</span>
              <span>{total ? Math.round((source.total / total) * 100) : 0}% base</span>
            </div>
          </article>
        )) : (
          <div className="empty-state">Sin fuentes registradas.</div>
        )}
      </div>
    </section>
  );
}

function MetricBreakdown({ title, items, tone = "default" }: { title: string; items: Array<{ label: string; value: number }>; tone?: string }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="metric-section">
      <h3>{title}</h3>
      {items.length ? (
        <div className="metric-bars">
          {items.map((item) => (
            <div className={`metric-bar-row tone-${tone}`} key={item.label}>
              <span>{formatMetricLabel(item.label)}</span>
              <div className="metric-bar-track">
                <i style={{ width: `${Math.max(5, Math.round((item.value / max) * 100))}%`, background: getMetricColor(item.label) }} />
              </div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">Sin datos todav&iacute;a.</div>
      )}
    </section>
  );
}

function SellerMetrics({ sellers }: { sellers: Stats["by_seller"] }) {
  return (
    <section className="metric-section">
      <h3>Por vendedor</h3>
      {sellers.length ? (
        <div className="metric-table">
          <div className="metric-table-head">
            <span>Vendedor</span>
            <span>Asignados</span>
            <span>Abiertas</span>
            <span>Calientes</span>
            <span>Salientes 7d</span>
          </div>
          {sellers.map((seller) => (
            <div className="metric-table-row" key={seller.id ?? seller.name}>
              <strong>{seller.name}</strong>
              <span>{seller.assigned_contacts}</span>
              <span>{seller.open_conversations}</span>
              <span>{seller.hot_contacts}</span>
              <span>{seller.outbound_7d}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">Sin vendedores activos.</div>
      )}
    </section>
  );
}

function DailyMetrics({ days, groupBy }: { days: Stats["daily"]; groupBy: "day" | "week" | "month" }) {
  const max = Math.max(...days.map((day) => day.inbound + day.outbound), 1);

  return (
    <section className="metric-section">
      <h3>Actividad diaria</h3>
      <div className="daily-chart">
        {days.map((day) => {
          const total = day.inbound + day.outbound;
          return (
            <div className="daily-bar" key={day.date} title={`${formatMetricDate(day.date, groupBy)} - ${total} mensajes`}>
              <div className="daily-bar-stack" style={{ height: `${Math.max(4, Math.round((total / max) * 100))}%` }}>
                <span className="daily-inbound" style={{ flex: day.inbound || 0.001 }} />
                <span className="daily-outbound" style={{ flex: day.outbound || 0.001 }} />
              </div>
              <small>{formatMetricDate(day.date, groupBy)}</small>
            </div>
          );
        })}
      </div>
      <div className="metric-legend">
        <span><i className="inbound-dot" /> Entrantes</span>
        <span><i className="outbound-dot" /> Salientes</span>
      </div>
    </section>
  );
}

function formatMetricLabel(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Sin dato";
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function formatMetricDate(value: string, groupBy: "day" | "week" | "month") {
  const [year, month, day] = value.split("-");
  if (groupBy === "month") {
    return `${month}/${year.slice(2)}`;
  }
  if (groupBy === "week") {
    return `Sem. ${day}/${month}`;
  }
  return `${day}/${month}`;
}

function toDateInputDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function getMetricColor(label: string) {
  const key = label.toLowerCase();
  if (key.includes("caliente") || key.includes("hot")) return "#f43f5e";
  if (key.includes("cliente") || key.includes("positivo") || key.includes("sent")) return "#42c767";
  if (key.includes("comparador") || key.includes("quoted") || key.includes("cotizado")) return "#fbbf24";
  if (key.includes("handoff") || key.includes("escal")) return "#f97316";
  if (key.includes("whatsapp")) return "#25d366";
  if (key.includes("selector")) return "#8dc63f";
  if (key.includes("neutral")) return "#9ca3af";
  if (key.includes("molesto") || key.includes("preocupado") || key.includes("negativo")) return "#ff6b6b";
  return "#79d1f2";
}

function SettingsPanel({ users }: { users: AppUser[] }) {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [openSettingsSection, setOpenSettingsSection] = useState("delay");
  const [channelAccounts, setChannelAccounts] = useState<ChannelAccount[]>([]);
  const [channelForm, setChannelForm] = useState<ChannelAccountForm>({
    id: "",
    slug: "instagram-febecos",
    name: "Instagram Febecos",
    channel: "instagram",
    externalAccountId: "",
    phoneNumber: "",
    provider: "cloud_api",
    bridgeUrl: "",
    accessToken: "",
    bridgeToken: "",
    webhookToken: "",
    keepAccessToken: false,
    keepBridgeToken: false,
    keepWebhookToken: false,
    autoReplyEnabled: false,
    active: false
  });
  const [webhooks, setWebhooks] = useState<OutgoingWebhook[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<OutgoingWebhookDelivery[]>([]);
  const [webhookForm, setWebhookForm] = useState({
    id: "",
    name: "Selector / pagina Febecos",
    url: "",
    secret: "",
    keepSecret: false,
    events: ["selector_checkout_abierto", "lead_caliente", "chat_escalado"],
    active: true
  });
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState("");
  const settingsNotificationAudioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    void loadSettings();
    void loadChannelAccounts();
    void loadOutgoingWebhooks();
  }, []);

  async function loadSettings() {
    const response = await fetch("/api/settings");
    const payload = await readJsonResponse(response);

    if (response.ok) {
      setSettings(payload?.settings ?? []);
    }
  }

  async function loadOutgoingWebhooks() {
    const response = await fetch("/api/outgoing-webhooks");
    const payload = await readJsonResponse(response);

    if (response.ok) {
      setWebhooks(payload?.webhooks ?? []);
      setWebhookDeliveries(payload?.deliveries ?? []);
    }
  }

  async function loadChannelAccounts() {
    const response = await fetch("/api/channel-accounts");
    const payload = await readJsonResponse(response);

    if (response.ok) {
      setChannelAccounts(payload?.accounts ?? []);
    }
  }

  function getValue(key: string, fallback: unknown = "") {
    return settings.find((setting) => setting.key === key)?.value ?? fallback;
  }

  async function saveSetting(
    key: SettingKey,
    value: string | number | null | NotificationSoundConfig | Record<string, UserNotificationSoundSetting>
  ) {
    setSavingKey(key);
    setMessage("");

    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, value })
    });
    const payload = await readJsonResponse(response);
    setSavingKey("");

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos guardar la configuracion.");
      return false;
    }

    setSettings(payload?.settings ?? []);
    setMessage("Configuracion guardada.");
    return true;
  }

  async function saveSettingsBatch(
    items: Array<{ key: SettingKey; value: string | number | null | NotificationSoundConfig | Record<string, UserNotificationSoundSetting> }>,
    savingId: string
  ) {
    setSavingKey(savingId);
    setMessage("");

    let latestSettings: AppSetting[] | null = null;

    for (const item of items) {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item)
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setSavingKey("");
        setMessage(payload?.error ?? "No pudimos guardar la configuracion.");
        return false;
      }

      latestSettings = payload?.settings ?? latestSettings;
    }

    setSavingKey("");
    if (latestSettings) {
      setSettings(latestSettings);
    }
    setMessage("Configuracion guardada.");
    return true;
  }

  function editWebhook(webhook: OutgoingWebhook) {
    setOpenSettingsSection("webhooks");
    setWebhookForm({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      secret: "",
      keepSecret: webhook.has_secret,
      events: webhook.events.length ? webhook.events : ["selector_checkout_abierto"],
      active: webhook.active
    });
  }

  function editChannelAccount(account: ChannelAccount) {
    setOpenSettingsSection("channels");
    setChannelForm({
      id: account.id,
      slug: account.slug,
      name: account.name,
      channel: account.channel,
      externalAccountId: account.external_account_id ?? "",
      phoneNumber: account.phone_number ?? "",
      provider: account.settings.provider === "qr_bridge" ? "qr_bridge" : "cloud_api",
      bridgeUrl: typeof account.settings.bridge_url === "string" ? account.settings.bridge_url : "",
      accessToken: "",
      bridgeToken: "",
      webhookToken: "",
      keepAccessToken: account.has_access_token,
      keepBridgeToken: account.has_bridge_token,
      keepWebhookToken: account.has_webhook_token,
      autoReplyEnabled: account.auto_reply_enabled,
      active: account.active
    });
  }

  function resetChannelForm(channel: ChannelAccountForm["channel"] = "instagram") {
    setChannelForm({
      id: "",
      slug: channel === "instagram" ? "instagram-febecos" : `${channel}-febecos`,
      name: channel === "instagram" ? "Instagram Febecos" : `${humanizeTemplateName(channel)} Febecos`,
      channel,
      externalAccountId: "",
      phoneNumber: "",
      provider: "cloud_api",
      bridgeUrl: "",
      accessToken: "",
      bridgeToken: "",
      webhookToken: "",
      keepAccessToken: false,
      keepBridgeToken: false,
      keepWebhookToken: false,
      autoReplyEnabled: false,
      active: false
    });
  }

  function updateSoundUser(userId: string, notificationSound: UserNotificationSoundSetting) {
    setSettings((current) => {
      const currentMap = normalizeUserNotificationSoundMap(
        current.find((setting) => setting.key === "notification_sound_users")?.value ?? {}
      );

      return upsertLocalSetting(current, "notification_sound_users", {
        ...currentMap,
        [userId]: notificationSound
      });
    });
  }

  async function saveUserNotificationSound(user: AppUser) {
    const notificationSoundUsers = normalizeUserNotificationSoundMap(getValue("notification_sound_users", {}));
    setSavingKey(`notification-user-${user.id}`);
    setMessage("");

    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: "notification_sound_users",
        value: notificationSoundUsers
      })
    });
    const payload = await readJsonResponse(response);
    setSavingKey("");

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos guardar el sonido del usuario.");
      return;
    }

    setSettings(payload?.settings ?? settings);
    setMessage("Sonido del usuario guardado.");
  }

  async function saveChannelAccount() {
    setSavingKey("channel-account");
    setMessage("");

    const response = await fetch("/api/channel-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "upsert",
        id: channelForm.id || null,
        slug: channelForm.slug || null,
        name: channelForm.name,
        channel: channelForm.channel,
        externalAccountId: channelForm.externalAccountId || null,
        phoneNumber: channelForm.phoneNumber || null,
        provider: channelForm.provider,
        bridgeUrl: channelForm.provider === "qr_bridge" ? channelForm.bridgeUrl || null : null,
        accessToken: channelForm.accessToken || null,
        bridgeToken: channelForm.provider === "qr_bridge" ? channelForm.bridgeToken || null : null,
        webhookToken: channelForm.provider === "qr_bridge" ? channelForm.webhookToken || null : null,
        keepAccessToken: channelForm.keepAccessToken && !channelForm.accessToken,
        keepBridgeToken: channelForm.keepBridgeToken && !channelForm.bridgeToken,
        keepWebhookToken: channelForm.keepWebhookToken && !channelForm.webhookToken,
        autoReplyEnabled: channelForm.autoReplyEnabled,
        active: channelForm.active
      })
    });
    const payload = await readJsonResponse(response);
    setSavingKey("");

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos guardar la cuenta.");
      return false;
    }

    setChannelAccounts(payload?.accounts ?? []);
    setChannelForm((current) => ({
      ...current,
      accessToken: "",
      bridgeToken: "",
      webhookToken: "",
      keepAccessToken: false,
      keepBridgeToken: false,
      keepWebhookToken: false
    }));
    setMessage("Cuenta conectada guardada.");
    return true;
  }

  async function disableChannelAccount(id: string) {
    setSavingKey(`channel-disable-${id}`);
    setMessage("");

    const response = await fetch("/api/channel-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "disable", id })
    });
    const payload = await readJsonResponse(response);
    setSavingKey("");

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos desactivar la cuenta.");
      return;
    }

    setChannelAccounts(payload?.accounts ?? []);
    setMessage("Cuenta desactivada.");
  }

  function toggleWebhookEvent(eventName: string) {
    setWebhookForm((current) => {
      const events = current.events.includes(eventName)
        ? current.events.filter((event) => event !== eventName)
        : [...current.events, eventName];

      return { ...current, events: events.length ? events : current.events };
    });
  }

  async function saveOutgoingWebhook() {
    setSavingKey("outgoing-webhook");
    setMessage("");

    const response = await fetch("/api/outgoing-webhooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "upsert",
        id: webhookForm.id || null,
        name: webhookForm.name,
        url: webhookForm.url,
        secret: webhookForm.secret,
        keepSecret: webhookForm.keepSecret && !webhookForm.secret,
        events: webhookForm.events,
        active: webhookForm.active
      })
    });
    const payload = await readJsonResponse(response);
    setSavingKey("");

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos guardar el webhook.");
      return false;
    }

    setWebhooks(payload?.webhooks ?? []);
    setWebhookDeliveries(payload?.deliveries ?? []);
    setWebhookForm((current) => ({ ...current, id: "", secret: "", keepSecret: false }));
    setMessage("Webhook guardado.");
    return true;
  }

  async function testWebhook(id: string) {
    setSavingKey(`test-${id}`);
    setMessage("");

    const response = await fetch("/api/outgoing-webhooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "test", id })
    });
    const payload = await readJsonResponse(response);
    setSavingKey("");

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos probar el webhook.");
      return;
    }

    setWebhooks(payload?.webhooks ?? []);
    setWebhookDeliveries(payload?.deliveries ?? []);
    setMessage("Prueba enviada. Revisar estado en el historial.");
  }

  async function deleteWebhook(id: string) {
    setSavingKey(`delete-${id}`);
    setMessage("");

    const response = await fetch("/api/outgoing-webhooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", id })
    });
    const payload = await readJsonResponse(response);
    setSavingKey("");

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos eliminar el webhook.");
      return;
    }

    setWebhooks(payload?.webhooks ?? []);
    setWebhookDeliveries(payload?.deliveries ?? []);
    setWebhookForm((current) => (current.id === id ? { ...current, id: "", secret: "", keepSecret: false } : current));
    setMessage("Webhook eliminado.");
  }

  const delayValue = Number(getValue("auto_reply_delay_seconds", 90));
  const hotLeadAssignee = String(getValue("hot_lead_default_assignee_id", "") ?? "");
  const selectorFlowId = String(getValue("whatsapp_selector_flow_id", "") ?? "");
  const selectorFlowScreen = String(getValue("whatsapp_selector_flow_screen", "DATOS_CAMPO") ?? "DATOS_CAMPO");
  const selectorFlowHeader = String(getValue("whatsapp_selector_flow_header", "Selector Febecos") ?? "Selector Febecos");
  const selectorFlowBody = String(
    getValue(
      "whatsapp_selector_flow_body",
      "Completa estos datos dentro de WhatsApp y te sugerimos el equipo de bombeo solar adecuado."
    ) ?? ""
  );
  const selectorFlowFooter = String(getValue("whatsapp_selector_flow_footer", "Febecos bombas solares") ?? "Febecos bombas solares");
  const selectorFlowCta = String(getValue("whatsapp_selector_flow_cta", "Abrir selector") ?? "Abrir selector");
  const notificationSound = normalizeNotificationSoundConfig(getValue("notification_sound", DEFAULT_NOTIFICATION_SOUND_CONFIG));
  const notificationSoundUsers = normalizeUserNotificationSoundMap(getValue("notification_sound_users", {}));
  const notificationSoundLabel =
    NOTIFICATION_SOUND_OPTIONS.find((option) => option.value === notificationSound.sound)?.label ?? "Campanita";

  return (
    <section className="admin-panel settings-panel">
      <div className="panel-title">
        <div>
          <h2>Configuracion</h2>
          <p>Parametros operativos editables sin tocar codigo ni Vercel.</p>
        </div>
        {message ? <span className={message.includes("No ") ? "warn" : "ok"}>{message}</span> : null}
      </div>

      <div className="settings-stack">
        <div className="settings-tile-grid">
        <article className={`settings-card settings-accordion ${openSettingsSection === "delay" ? "is-open" : ""}`}>
          <button
            className="settings-card-header"
            onClick={() => setOpenSettingsSection((current) => (current === "delay" ? "" : "delay"))}
            type="button"
          >
            <span>
              <h3>Demora de respuesta IA</h3>
              <p>Espera antes de responder para juntar mensajes seguidos.</p>
            </span>
            <span className="settings-card-meta">{delayValue}s</span>
            <ChevronDown size={18} />
          </button>
        </article>

        <article className={`settings-card settings-accordion ${openSettingsSection === "hotLead" ? "is-open" : ""}`}>
          <button
            className="settings-card-header"
            onClick={() => setOpenSettingsSection((current) => (current === "hotLead" ? "" : "hotLead"))}
            type="button"
          >
            <span>
              <h3>Vendedor por defecto de calientes</h3>
              <p>Destino automatico cuando no hay regla mas especifica.</p>
            </span>
            <span className="settings-card-meta">
              {users.find((user) => user.id === hotLeadAssignee)?.full_name ?? "Automatico"}
            </span>
            <ChevronDown size={18} />
          </button>
        </article>

        <article className={`settings-card settings-accordion ${openSettingsSection === "sound" ? "is-open" : ""}`}>
          <button
            className="settings-card-header"
            onClick={() => setOpenSettingsSection((current) => (current === "sound" ? "" : "sound"))}
            type="button"
          >
            <span>
              <h3>Sonido de notificaciones</h3>
              <p>Sonido global y excepciones por usuario para chats y tareas.</p>
            </span>
            <span className="settings-card-meta">{notificationSoundLabel} · {Math.round(notificationSound.volume * 100)}%</span>
            <ChevronDown size={18} />
          </button>
        </article>

        <article className={`settings-card settings-accordion ${openSettingsSection === "flow" ? "is-open" : ""}`}>
          <button
            className="settings-card-header"
            onClick={() => setOpenSettingsSection((current) => (current === "flow" ? "" : "flow"))}
            type="button"
          >
            <span>
              <h3>Mensaje para abrir Flow publicado</h3>
              <p>Configura el mensaje que abre el Flow ya publicado en Meta.</p>
            </span>
            <span className="settings-card-meta">{selectorFlowId ? `Flow ${selectorFlowId}` : "Sin Flow"}</span>
            <ChevronDown size={18} />
          </button>
        </article>

        <article className={`settings-card settings-accordion ${openSettingsSection === "channels" ? "is-open" : ""}`}>
          <button
            className="settings-card-header"
            onClick={() => setOpenSettingsSection((current) => (current === "channels" ? "" : "channels"))}
            type="button"
          >
            <span>
              <h3>Cuentas conectadas</h3>
              <p>WhatsApp, Instagram y futuros canales separados por cuenta.</p>
            </span>
            <span className="settings-card-meta">{channelAccounts.filter((account) => account.active).length} activas</span>
            <ChevronDown size={18} />
          </button>
        </article>

        <article className={`settings-card settings-accordion webhook-settings-card ${openSettingsSection === "webhooks" ? "is-open" : ""}`}>
          <button
            className="settings-card-header"
            onClick={() => setOpenSettingsSection((current) => (current === "webhooks" ? "" : "webhooks"))}
            type="button"
          >
            <span>
              <h3>Webhooks salientes</h3>
              <p>Envia eventos de FEBO a pagina, selector u otro sistema.</p>
            </span>
            <span className="settings-card-meta">{webhooks.length} destinos</span>
            <ChevronDown size={18} />
          </button>
        </article>
        </div>

        {openSettingsSection ? (
          <section className="settings-detail-panel">
            {openSettingsSection === "delay" ? (
              <div className="settings-card-body">
                <label className="field">
                  <FieldHelpLabel
                    help="Cuantos segundos espera FEBO antes de responder. Ayuda a juntar varios mensajes seguidos y evitar respuestas repetidas."
                    label="Segundos"
                  />
                  <input
                    max={900}
                    min={0}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setSettings((current) => upsertLocalSetting(current, "auto_reply_delay_seconds", value));
                    }}
                    type="number"
                    value={delayValue}
                  />
                </label>
                <button
                  className="primary"
                  disabled={savingKey === "auto_reply_delay_seconds"}
                  onClick={() => void saveSetting("auto_reply_delay_seconds", delayValue).then((ok) => {
                    if (ok) setOpenSettingsSection("");
                  })}
                  type="button"
                >
                  {savingKey === "auto_reply_delay_seconds" ? "Guardando" : "Guardar demora"}
                </button>
              </div>
            ) : null}

            {openSettingsSection === "hotLead" ? (
              <div className="settings-card-body">
                <label className="field">
                  <FieldHelpLabel
                    help="Vendedor que recibe los leads calientes cuando no hay otra regla mas especifica. No cambia conversaciones ya asignadas."
                    label="Usuario"
                  />
                  <select
                    onChange={(event) => {
                      setSettings((current) => upsertLocalSetting(current, "hot_lead_default_assignee_id", event.target.value || null));
                    }}
                    value={hotLeadAssignee}
                  >
                    <option value="">Automatico por prioridad</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.full_name}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="primary"
                  disabled={savingKey === "hot_lead_default_assignee_id"}
                  onClick={() => void saveSetting("hot_lead_default_assignee_id", hotLeadAssignee || null).then((ok) => {
                    if (ok) setOpenSettingsSection("");
                  })}
                  type="button"
                >
                  {savingKey === "hot_lead_default_assignee_id" ? "Guardando" : "Guardar vendedor"}
                </button>
              </div>
            ) : null}

            {openSettingsSection === "sound" ? (
              <div className="settings-card-body notification-sound-settings">
                <div className="notification-sound-global">
                  <label className="field">
                    <FieldHelpLabel
                      help="Sonido por defecto para todos los usuarios. Si un usuario no tiene configuracion propia, usa este valor."
                      label="Sonido global"
                    />
                    <select
                      onChange={(event) => {
                        setSettings((current) =>
                          upsertLocalSetting(current, "notification_sound", {
                            ...notificationSound,
                            sound: event.target.value as NotificationSoundName
                          })
                        );
                      }}
                      value={notificationSound.sound}
                    >
                      {NOTIFICATION_SOUND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field sound-volume-field">
                    <FieldHelpLabel
                      help="Volumen del sonido global. Los usuarios con configuracion propia pueden tener otro volumen."
                      label={`Volumen global ${Math.round(notificationSound.volume * 100)}%`}
                    />
                    <input
                      max={100}
                      min={0}
                      onChange={(event) => {
                        setSettings((current) =>
                          upsertLocalSetting(current, "notification_sound", {
                            ...notificationSound,
                            volume: Number(event.target.value) / 100
                          })
                        );
                      }}
                      type="range"
                      value={Math.round(notificationSound.volume * 100)}
                    />
                  </label>
                  <div className="settings-actions-row">
                    <button
                      className="primary"
                      disabled={savingKey === "notification_sound"}
                      onClick={() => void saveSetting("notification_sound", notificationSound)}
                      type="button"
                    >
                      {savingKey === "notification_sound" ? "Guardando" : "Guardar sonido global"}
                    </button>
                    <button
                      onClick={() => void playInboxNotificationSound(settingsNotificationAudioContextRef, notificationSound)}
                      type="button"
                    >
                      <BellRing size={16} />
                      Probar
                    </button>
                  </div>
                </div>

                <div className="notification-user-sounds">
                  <h4>Configuracion puntual por usuario</h4>
                  <div className="notification-user-list">
                    {users.map((user) => {
                      const userSound = notificationSoundUsers[user.id] ?? { mode: "default" };
                      const effectiveSound = resolveUserNotificationSound(notificationSound, userSound);
                      const savingUser = savingKey === `notification-user-${user.id}`;

                      return (
                        <div key={user.id} className="notification-user-row">
                          <div className="notification-user-info">
                            <strong>{user.full_name}</strong>
                            <span>{user.role} · {userSound.mode === "custom" ? "personalizado" : "usa global"}</span>
                          </div>
                          <select
                            aria-label={`Modo de sonido de ${user.full_name}`}
                            onChange={(event) => {
                              const mode = event.target.value as UserNotificationSoundSetting["mode"];
                              updateSoundUser(
                                user.id,
                                mode === "custom"
                                  ? { mode, sound: effectiveSound.sound, volume: effectiveSound.volume }
                                  : { mode: "default" }
                              );
                            }}
                            value={userSound.mode}
                          >
                            <option value="default">Global</option>
                            <option value="custom">Propio</option>
                          </select>
                          <select
                            aria-label={`Sonido de ${user.full_name}`}
                            disabled={userSound.mode !== "custom"}
                            onChange={(event) =>
                              updateSoundUser(user.id, {
                                mode: "custom",
                                sound: event.target.value as NotificationSoundName,
                                volume: effectiveSound.volume
                              })
                            }
                            value={effectiveSound.sound}
                          >
                            {NOTIFICATION_SOUND_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <label className="notification-user-volume">
                            <span>{Math.round(effectiveSound.volume * 100)}%</span>
                            <input
                              disabled={userSound.mode !== "custom"}
                              max={100}
                              min={0}
                              onChange={(event) =>
                                updateSoundUser(user.id, {
                                  mode: "custom",
                                  sound: effectiveSound.sound,
                                  volume: Number(event.target.value) / 100
                                })
                              }
                              type="range"
                              value={Math.round(effectiveSound.volume * 100)}
                            />
                          </label>
                          <div className="notification-user-actions">
                            <button
                              disabled={savingUser}
                              onClick={() => void saveUserNotificationSound(user)}
                              type="button"
                            >
                              {savingUser ? "Guardando" : "Guardar"}
                            </button>
                            <button
                              onClick={() => void playInboxNotificationSound(settingsNotificationAudioContextRef, effectiveSound)}
                              type="button"
                            >
                              Probar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {openSettingsSection === "flow" ? (
              <div className="settings-card-body settings-card-body-grid">
                <label className="field">
                  <FieldHelpLabel
                    help="ID del Flow ya publicado en Meta. Cambiarlo aca no edita Meta; solo le dice a FEBO que Flow debe enviar."
                    label="Flow ID publicado"
                  />
                  <input
                    placeholder="Ej: 890862800687247"
                    onChange={(event) => setSettings((current) => upsertLocalSetting(current, "whatsapp_selector_flow_id", event.target.value))}
                    value={selectorFlowId}
                  />
                </label>
                <label className="field">
                  <FieldHelpLabel
                    help="Nombre tecnico de la pantalla inicial del Flow. Tiene que existir dentro del Flow publicado en Meta."
                    label="Pantalla inicial"
                  />
                  <input
                    onChange={(event) => setSettings((current) => upsertLocalSetting(current, "whatsapp_selector_flow_screen", event.target.value))}
                    value={selectorFlowScreen}
                  />
                </label>
                <label className="field">
                  <FieldHelpLabel
                    help="Titulo del mensaje interactivo que FEBO envia por WhatsApp antes de abrir el Flow."
                    label="Titulo"
                  />
                  <input
                    onChange={(event) => setSettings((current) => upsertLocalSetting(current, "whatsapp_selector_flow_header", event.target.value))}
                    value={selectorFlowHeader}
                  />
                </label>
                <label className="field">
                  <FieldHelpLabel
                    help="Texto que acompana el boton. Esto no cambia los campos del Flow, solo el mensaje que ve el cliente."
                    label="Texto"
                  />
                  <textarea
                    onChange={(event) => setSettings((current) => upsertLocalSetting(current, "whatsapp_selector_flow_body", event.target.value))}
                    value={selectorFlowBody}
                  />
                </label>
                <label className="field">
                  <FieldHelpLabel
                    help="Linea chica al pie del mensaje interactivo de WhatsApp. Sirve para marca o aclaracion breve."
                    label="Pie"
                  />
                  <input
                    onChange={(event) => setSettings((current) => upsertLocalSetting(current, "whatsapp_selector_flow_footer", event.target.value))}
                    value={selectorFlowFooter}
                  />
                </label>
                <label className="field">
                  <FieldHelpLabel
                    help="Texto del boton que abre el Flow en WhatsApp. Meta permite hasta 20 caracteres."
                    label="Boton"
                  />
                  <input
                    maxLength={20}
                    onChange={(event) => setSettings((current) => upsertLocalSetting(current, "whatsapp_selector_flow_cta", event.target.value))}
                    value={selectorFlowCta}
                  />
                </label>
                <div className="settings-actions-row">
                  <button
                    className="primary"
                    disabled={savingKey === "selector-flow"}
                    onClick={() =>
                      void saveSettingsBatch(
                        [
                          { key: "whatsapp_selector_flow_id", value: selectorFlowId },
                          { key: "whatsapp_selector_flow_screen", value: selectorFlowScreen },
                          { key: "whatsapp_selector_flow_header", value: selectorFlowHeader },
                          { key: "whatsapp_selector_flow_body", value: selectorFlowBody },
                          { key: "whatsapp_selector_flow_footer", value: selectorFlowFooter },
                          { key: "whatsapp_selector_flow_cta", value: selectorFlowCta }
                        ],
                        "selector-flow"
                      ).then((ok) => {
                        if (ok) setOpenSettingsSection("");
                      })
                    }
                    type="button"
                  >
                    {savingKey === "selector-flow" ? "Guardando" : "Guardar configuracion del Flow"}
                  </button>
                </div>
              </div>
            ) : null}

            {openSettingsSection === "channels" ? (
              <div className="settings-card-body">
                <div className="webhook-layout">
                  <div className="webhook-form">
                    <label className="field">
                      <FieldHelpLabel
                        help="Nombre interno de la cuenta. Ejemplo: Instagram Febecos. Sirve para ver de donde viene cada conversacion."
                        label="Nombre"
                      />
                      <input
                        onChange={(event) => setChannelForm((current) => ({ ...current, name: event.target.value }))}
                        value={channelForm.name}
                      />
                    </label>
                    <label className="field">
                      <FieldHelpLabel
                        help="Identificador estable de FEBO para esta cuenta. Conviene no cambiarlo despues de conectar webhooks."
                        label="Slug interno"
                      />
                      <input
                        onChange={(event) => setChannelForm((current) => ({ ...current, slug: event.target.value }))}
                        value={channelForm.slug}
                      />
                    </label>
                    <label className="field">
                      <FieldHelpLabel
                        help="Canal al que pertenece esta cuenta. Ahora empezamos por Instagram; luego seguimos con Facebook, TikTok y segundo WhatsApp."
                        label="Canal"
                      />
                      <select
                        onChange={(event) => resetChannelForm(event.target.value as ChannelAccountForm["channel"])}
                        value={channelForm.channel}
                      >
                        <option value="instagram">Instagram</option>
                        <option value="facebook">Facebook</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="tiktok">TikTok</option>
                      </select>
                    </label>
                    {channelForm.channel === "whatsapp" ? (
                      <label className="field">
                        <FieldHelpLabel
                          help="Cloud API usa Meta oficial. QR bridge usa un servicio externo persistente conectado por codigo QR."
                          label="Proveedor WhatsApp"
                        />
                        <select
                          onChange={(event) => setChannelForm((current) => ({ ...current, provider: event.target.value as ChannelAccountForm["provider"] }))}
                          value={channelForm.provider}
                        >
                          <option value="cloud_api">Cloud API oficial</option>
                          <option value="qr_bridge">QR bridge</option>
                        </select>
                      </label>
                    ) : null}
                    <label className="field">
                      <FieldHelpLabel
                        help="ID externo de Meta/TikTok para empatar webhooks entrantes con esta cuenta. En Instagram suele ser el Instagram Business Account ID."
                        label="ID externo"
                      />
                      <input
                        placeholder="Instagram Business Account ID"
                        onChange={(event) => setChannelForm((current) => ({ ...current, externalAccountId: event.target.value }))}
                        value={channelForm.externalAccountId}
                      />
                    </label>
                    <label className="field">
                      <FieldHelpLabel
                        help="Opcional. Para WhatsApp puede ser numero; para Instagram puede quedar vacio."
                        label="Telefono / referencia"
                      />
                      <input
                        onChange={(event) => setChannelForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                        value={channelForm.phoneNumber}
                      />
                    </label>
                    {channelForm.channel === "whatsapp" && channelForm.provider === "qr_bridge" ? (
                      <>
                        <label className="field">
                          <FieldHelpLabel
                            help="URL publica del servicio QR bridge persistente. Ejemplo: https://whatsapp-qr.febecos.com"
                            label="URL QR bridge"
                          />
                          <input
                            placeholder="https://whatsapp-qr.febecos.com"
                            onChange={(event) => setChannelForm((current) => ({ ...current, bridgeUrl: event.target.value }))}
                            value={channelForm.bridgeUrl}
                          />
                        </label>
                        <label className="field">
                          <FieldHelpLabel
                            help="Token que FEBO usa para pedirle al bridge que envie mensajes. Si editas y queda vacio, conserva el guardado."
                            label="Token bridge salida"
                          />
                          <input
                            placeholder={channelForm.keepBridgeToken ? "Token guardado; dejar vacio para conservar" : "Token del bridge"}
                            onChange={(event) => setChannelForm((current) => ({ ...current, bridgeToken: event.target.value }))}
                            type="password"
                            value={channelForm.bridgeToken}
                          />
                        </label>
                        <label className="field">
                          <FieldHelpLabel
                            help="Token que el bridge debe mandar a FEBO en /api/whatsapp-qr/webhook para registrar mensajes entrantes."
                            label="Token webhook entrada"
                          />
                          <input
                            placeholder={channelForm.keepWebhookToken ? "Token guardado; dejar vacio para conservar" : "Token webhook"}
                            onChange={(event) => setChannelForm((current) => ({ ...current, webhookToken: event.target.value }))}
                            type="password"
                            value={channelForm.webhookToken}
                          />
                        </label>
                      </>
                    ) : null}
                    <label className="field">
                      <FieldHelpLabel
                        help="Token de acceso del canal. FEBO lo guarda, pero no lo muestra. Si editas y lo dejas vacio, conserva el token anterior."
                        label="Token de acceso"
                      />
                      <input
                        placeholder={channelForm.keepAccessToken ? "Token guardado; dejar vacio para conservar" : "Pegar token"}
                        onChange={(event) => setChannelForm((current) => ({ ...current, accessToken: event.target.value }))}
                        type="password"
                        value={channelForm.accessToken}
                      />
                    </label>
                    <label className="toggle-row">
                      <input
                        checked={channelForm.active}
                        onChange={(event) => setChannelForm((current) => ({ ...current, active: event.target.checked }))}
                        type="checkbox"
                      />
                      Cuenta activa
                    </label>
                    <label className="toggle-row">
                      <input
                        checked={channelForm.autoReplyEnabled}
                        onChange={(event) => setChannelForm((current) => ({ ...current, autoReplyEnabled: event.target.checked }))}
                        type="checkbox"
                      />
                      Respuesta automatica IA
                    </label>
                    <div className="settings-actions-row">
                      <button
                        className="primary"
                        disabled={savingKey === "channel-account"}
                        onClick={() => void saveChannelAccount()}
                        type="button"
                      >
                        {savingKey === "channel-account" ? "Guardando" : channelForm.id ? "Guardar cuenta" : "Crear cuenta"}
                      </button>
                      <button onClick={() => resetChannelForm("instagram")} type="button">Nueva Instagram</button>
                    </div>
                  </div>

                  <div className="webhook-list">
                    <h4>Cuentas configuradas</h4>
                    {channelAccounts.length ? channelAccounts.map((account) => {
                      const channelMeta = getConversationChannelMeta({
                        account_name: account.name,
                        channel: account.channel,
                        platform: account.channel
                      });

                      return (
                        <div key={account.id} className="webhook-item">
                          <div>
                            <strong className={channelMeta.className}>{account.name}</strong>
                            <span>
                              {channelMeta.label} · {account.active ? "Activa" : "Inactiva"} · {account.auto_reply_enabled ? "IA activa" : "IA apagada"}
                              {account.has_access_token ? " · token guardado" : ""}
                              {account.settings.provider === "qr_bridge" ? " · QR bridge" : ""}
                              {account.has_bridge_token ? " · bridge token" : ""}
                            </span>
                            <small>{account.external_account_id || account.phone_number || account.slug}</small>
                          </div>
                          <div className="webhook-actions">
                            <button onClick={() => editChannelAccount(account)} type="button">Editar</button>
                            <button
                              className="danger"
                              disabled={savingKey === `channel-disable-${account.id}`}
                              onClick={() => void disableChannelAccount(account.id)}
                              type="button"
                            >
                              Desactivar
                            </button>
                          </div>
                        </div>
                      );
                    }) : <p>No hay cuentas configuradas todavia.</p>}
                  </div>
                </div>
              </div>
            ) : null}

            {openSettingsSection === "webhooks" ? (
              <div className="settings-card-body">

          <div className="webhook-layout">
            <div className="webhook-form">
              <label className="field">
                <FieldHelpLabel
                  help="Nombre interno para reconocer el destino. Ejemplo: pagina selector Febecos."
                  label="Nombre"
                />
                <input
                  onChange={(event) => setWebhookForm((current) => ({ ...current, name: event.target.value }))}
                  value={webhookForm.name}
                />
              </label>
              <label className="field">
                <FieldHelpLabel
                  help="Endpoint HTTPS que recibira los eventos por POST. Code tiene que crear esta URL del lado de la pagina o selector."
                  label="URL destino"
                />
                <input
                  placeholder="https://..."
                  onChange={(event) => setWebhookForm((current) => ({ ...current, url: event.target.value }))}
                  value={webhookForm.url}
                />
              </label>
              <label className="field">
                <FieldHelpLabel
                  help="Clave compartida para firmar el payload con HMAC SHA-256. Si editas un webhook existente y lo dejas vacio, conserva el secreto anterior."
                  label="Token secreto"
                />
                <input
                  placeholder={webhookForm.keepSecret ? "Ya hay token guardado; dejar vacio para conservar" : "Token compartido"}
                  onChange={(event) => setWebhookForm((current) => ({ ...current, secret: event.target.value }))}
                  type="password"
                  value={webhookForm.secret}
                />
              </label>
              <label className="toggle-row">
                <input
                  checked={webhookForm.active}
                  onChange={(event) => setWebhookForm((current) => ({ ...current, active: event.target.checked }))}
                  type="checkbox"
                />
                Activo
              </label>

              <div className="webhook-events">
                <FieldHelpLabel
                  help="Eventos que FEBO envia a esta URL. Para conectar selector/pagina conviene empezar con Selector abierto, Lead caliente y Chat escalado."
                  label="Eventos"
                />
                <div className="webhook-event-grid">
                  {OUTGOING_WEBHOOK_EVENTS.map((event) => (
                    <label key={event.value} className="webhook-event-option">
                      <input
                        checked={webhookForm.events.includes(event.value)}
                        onChange={() => toggleWebhookEvent(event.value)}
                        type="checkbox"
                      />
                      {event.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="settings-actions-row">
                <button
                  className="primary"
                  disabled={savingKey === "outgoing-webhook"}
                  onClick={() => void saveOutgoingWebhook().then((ok) => {
                    if (ok) setOpenSettingsSection("");
                  })}
                  type="button"
                >
                  {savingKey === "outgoing-webhook" ? "Guardando" : webhookForm.id ? "Guardar cambios" : "Crear webhook"}
                </button>
                {webhookForm.id ? (
                  <button
                    onClick={() => setWebhookForm({
                      id: "",
                      name: "Selector / pagina Febecos",
                      url: "",
                      secret: "",
                      keepSecret: false,
                      events: ["selector_checkout_abierto", "lead_caliente", "chat_escalado"],
                      active: true
                    })}
                    type="button"
                  >
                    Nuevo
                  </button>
                ) : null}
              </div>
            </div>

            <div className="webhook-list">
              <h4>Destinos configurados</h4>
              {webhooks.length ? webhooks.map((webhook) => (
                <div key={webhook.id} className="webhook-item">
                  <div>
                    <strong>{webhook.name}</strong>
                    <span>{webhook.active ? "Activo" : "Inactivo"} · {webhook.has_secret ? "con token" : "sin token"}</span>
                    <small>{webhook.url}</small>
                  </div>
                  <div className="webhook-actions">
                    <button onClick={() => editWebhook(webhook)} type="button">Editar</button>
                    <button
                      disabled={savingKey === `test-${webhook.id}`}
                      onClick={() => void testWebhook(webhook.id)}
                      type="button"
                    >
                      Probar
                    </button>
                    <button
                      className="danger"
                      disabled={savingKey === `delete-${webhook.id}`}
                      onClick={() => void deleteWebhook(webhook.id)}
                      type="button"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              )) : <p>No hay webhooks configurados todavia.</p>}
            </div>
          </div>

          <div className="webhook-history">
            <h4>Ultimos envios</h4>
            {webhookDeliveries.length ? (
              <div className="webhook-history-list">
                {webhookDeliveries.slice(0, 10).map((delivery) => (
                  <div key={delivery.id} className={`webhook-history-item ${delivery.status}`}>
                    <strong>{delivery.event}</strong>
                    <span>{delivery.webhook_name ?? "Webhook eliminado"}</span>
                    <small>
                      {delivery.status} {delivery.response_status ? `· HTTP ${delivery.response_status}` : ""}
                      {" · "}
                      {formatMessageTime(delivery.created_at)}
                    </small>
                    {delivery.error ? <em>{delivery.error}</em> : null}
                  </div>
                ))}
              </div>
            ) : <p>Aun no hay envios registrados.</p>}
          </div>
          </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}

function FieldHelpLabel({ help, label }: { help: string; label: string }) {
  return (
    <span className="field-help-label">
      {label}
      <span className="help-tip" tabIndex={0}>
        <CircleHelp size={14} />
        <span className="help-tip-box">{help}</span>
      </span>
    </span>
  );
}

function normalizeNotificationSoundName(value: unknown): NotificationSoundName {
  return NOTIFICATION_SOUND_OPTIONS.some((option) => option.value === value) ? (value as NotificationSoundName) : "chime";
}

function normalizeNotificationVolume(value: unknown, fallback = DEFAULT_NOTIFICATION_SOUND_CONFIG.volume) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, numericValue));
}

function normalizeNotificationSoundConfig(value: unknown): NotificationSoundConfig {
  if (!value || typeof value !== "object") {
    return DEFAULT_NOTIFICATION_SOUND_CONFIG;
  }

  const config = value as Record<string, unknown>;

  return {
    sound: normalizeNotificationSoundName(config.sound),
    volume: normalizeNotificationVolume(config.volume)
  };
}

function normalizeUserNotificationSound(value: unknown): UserNotificationSoundSetting {
  if (!value || typeof value !== "object") {
    return { mode: "default" };
  }

  const setting = value as Record<string, unknown>;

  if (setting.mode !== "custom") {
    return { mode: "default" };
  }

  return {
    mode: "custom",
    sound: normalizeNotificationSoundName(setting.sound),
    volume: normalizeNotificationVolume(setting.volume)
  };
}

function normalizeUserNotificationSoundMap(value: unknown) {
  if (!value || typeof value !== "object") {
    return {} as Record<string, UserNotificationSoundSetting>;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([userId, setting]) => [
      userId,
      normalizeUserNotificationSound(setting)
    ])
  ) as Record<string, UserNotificationSoundSetting>;
}

function resolveUserNotificationSound(globalSound: NotificationSoundConfig, userSound: UserNotificationSoundSetting) {
  if (userSound.mode !== "custom") {
    return globalSound;
  }

  return {
    sound: userSound.sound ?? globalSound.sound,
    volume: normalizeNotificationVolume(userSound.volume, globalSound.volume)
  };
}

function upsertLocalSetting(settings: AppSetting[], key: string, value: unknown) {
  const exists = settings.some((setting) => setting.key === key);

  if (!exists) {
    return [...settings, { key, value, label: key, description: "", updated_at: "" }];
  }

  return settings.map((setting) => setting.key === key ? { ...setting, value } : setting);
}

function LabelsPanel({
  conversationLabelSlugs,
  currentUser,
  labels,
  onLabelsChange
}: {
  conversationLabelSlugs: string[];
  currentUser: AppUser;
  labels: LabelDefinition[];
  onLabelsChange: (labels: LabelDefinition[]) => void;
}) {
  const sortedLabels = useMemo(() => {
    const bySlug = new Map<string, LabelDefinition>();

    for (const option of CONSULTYPE_OPTIONS) {
      bySlug.set(option.value, {
        slug: option.value,
        name: option.label,
        color: getFallbackLabelColor(option.value),
        instructions: "",
        active: true,
        sort_order: 100,
        created_at: "",
        updated_at: ""
      });
    }

    for (const slug of TAG_FILTERS) {
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          slug,
          name: humanizeTemplateName(slug),
          color: getFallbackLabelColor(slug),
          instructions: "",
          active: true,
          sort_order: 150,
          created_at: "",
          updated_at: ""
        });
      }
    }

    for (const slug of conversationLabelSlugs) {
      if (slug && !bySlug.has(slug)) {
        bySlug.set(slug, {
          slug,
          name: humanizeTemplateName(slug),
          color: getFallbackLabelColor(slug),
          instructions: "",
          active: true,
          sort_order: 180,
          created_at: "",
          updated_at: ""
        });
      }
    }

    for (const label of labels) {
      bySlug.set(label.slug, label);
    }

    return Array.from(bySlug.values()).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [conversationLabelSlugs, labels]);
  const [labelSearch, setLabelSearch] = useState("");
  const [form, setForm] = useState({
    slug: "",
    name: "",
    color: "#38bdf8",
    instructions: "",
    active: true,
    sortOrder: 100
  });
  const [selectedSlug, setSelectedSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const filteredSortedLabels = useMemo(() => {
    const query = normalizeTemplateSearchKey(labelSearch);
    if (!query) {
      return sortedLabels;
    }

    return sortedLabels.filter((label) => normalizeTemplateSearchKey(`${label.name} ${label.slug}`).includes(query));
  }, [labelSearch, sortedLabels]);
  const selectedLabel = sortedLabels.find((label) => label.slug === selectedSlug) ?? filteredSortedLabels[0] ?? sortedLabels[0];
  const activeCount = labels.filter((label) => label.active).length;
  const isAdmin = currentUser.role === "admin";

  useEffect(() => {
    if (isAdmin && !selectedSlug && sortedLabels[0]) {
      editLabel(sortedLabels[0]);
    }
  }, [isAdmin, selectedSlug, sortedLabels]);

  function editLabel(label: LabelDefinition) {
    setSelectedSlug(label.slug);
    setForm({
      slug: label.slug,
      name: label.name,
      color: label.color,
      instructions: label.instructions,
      active: label.active,
      sortOrder: label.sort_order
    });
    setMessage("");
  }

  function newLabel() {
    setForm({ slug: "", name: "", color: "#38bdf8", instructions: "", active: true, sortOrder: 100 });
    setSelectedSlug("");
    setMessage("");
  }

  async function saveLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });
    const payload = await readJsonResponse(response);
    setSaving(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos guardar la etiqueta.");
      return;
    }

    if (Array.isArray(payload?.labels)) {
      onLabelsChange(payload.labels);
    }

    setMessage("Etiqueta guardada.");
    if (!form.slug && payload?.label?.slug) {
      setForm((current) => ({ ...current, slug: payload.label.slug }));
      setSelectedSlug(payload.label.slug);
    }

    if (!isAdmin) {
      setForm({ slug: "", name: "", color: "#38bdf8", instructions: "", active: true, sortOrder: 100 });
      setSelectedSlug("");
    }
  }

  async function restoreBaseLabels() {
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "restore-base" })
    });
    const payload = await readJsonResponse(response);
    setSaving(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos restaurar las etiquetas base.");
      return;
    }

    if (Array.isArray(payload?.labels)) {
      onLabelsChange(payload.labels);
      const current = payload.labels.find((label: LabelDefinition) => label.slug === selectedSlug) ?? payload.labels[0];
      if (current) {
        editLabel(current);
      }
    }

    setMessage("Etiquetas base restauradas.");
  }

  async function applyAiDescriptions() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "apply-ai-descriptions" })
    });
    const payload = await readJsonResponse(response);
    setSaving(false);
    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos cargar las descripciones.");
      return;
    }
    if (Array.isArray(payload?.labels)) {
      onLabelsChange(payload.labels);
      const current = payload.labels.find((label: LabelDefinition) => label.slug === selectedSlug) ?? payload.labels[0];
      if (current) editLabel(current);
    }
    setMessage("Descripciones para la IA actualizadas (solo se tocó la descripción, no nombre/color).");
  }

  if (!isAdmin) {
    return (
      <section className="admin-panel labels-panel">
        <div className="panel-title">
          <div>
            <h2>Etiquetas</h2>
            <p>Pod&eacute;s crear etiquetas simples para ordenar conversaciones. La configuraci&oacute;n de IA queda para administrador.</p>
            <small>{activeCount} etiquetas activas disponibles.</small>
          </div>
        </div>

        <form className="admin-form compact-label-form" onSubmit={saveLabel}>
          <label className="field">
            Nombre de etiqueta
            <input
              placeholder="Ej: Seguimiento especial"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>
          <label className="field color-field">
            Color
            <span>
              <input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
              <input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
            </span>
          </label>
          <button className="primary" disabled={saving} type="submit">
            <UserPlus size={17} />
            {saving ? "Guardando" : "Agregar etiqueta"}
          </button>
          {message ? <span className={message.includes("No ") ? "warn" : "ok"}>{message}</span> : null}
        </form>

        <div className="label-preview-strip label-simple-strip">
          {sortedLabels.map((label) => (
            <span className="tag-pill preview" key={label.slug} style={{ "--tag-color": label.color } as CSSProperties}>
              {label.name}
            </span>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="admin-panel labels-panel">
      <div className="panel-title">
        <div>
          <h2>Etiquetas autom&aacute;ticas de IA</h2>
          <p>Estas etiquetas ayudan a FEBO a clasificar conversaciones y orientar automatizaciones.</p>
          <small>{activeCount} configuradas activas. {sortedLabels.length} visibles entre base, conversaciones y personalizadas.</small>
        </div>
        <div className="label-panel-actions">
          <button className="secondary compact" disabled={saving} onClick={restoreBaseLabels} type="button">
            Restaurar base
          </button>
          <button className="primary compact" disabled={saving} onClick={applyAiDescriptions} type="button" title="Carga las descripciones para la IA recomendadas (solo la descripción, no toca nombre/color)">
            <Bot size={15} />
            Cargar descripciones IA
          </button>
          <button className="secondary compact" onClick={newLabel} type="button">
            <UserPlus size={15} />
            Agregar etiqueta
          </button>
        </div>
      </div>

      <div className="label-config-workspace">
        <aside className="label-config-sidebar">
          <label className="search-field label-search-field">
            <Search size={15} />
            <input
              placeholder="Buscar etiqueta"
              value={labelSearch}
              onChange={(event) => setLabelSearch(event.target.value)}
            />
          </label>
          <span className="label-sidebar-caption">
            {filteredSortedLabels.length} etiquetas
          </span>
          <div className="label-config-stack">
            {filteredSortedLabels.map((label) => {
              const configured = labels.some((item) => item.slug === label.slug);
              const isBase = TAG_FILTERS.includes(label.slug) || CONSULTYPE_OPTIONS.some((option) => option.value === label.slug);
              const sourceLabel = configured ? (isBase ? "Base" : "Personalizada") : "En conversaciones";
              return (
                <button
                  className={`label-config-item ${selectedLabel?.slug === label.slug ? "selected" : ""}`}
                  key={label.slug}
                  onClick={() => editLabel(label)}
                  type="button"
                >
                  <span className="tag-pill preview" style={{ "--tag-color": label.color } as CSSProperties}>
                    {label.name}
                  </span>
                  <span>
                    <strong>{label.name}</strong>
                    <small>
                      {sourceLabel} - {label.active ? "Activa" : "Inactiva"}
                    </small>
                  </span>
                </button>
              );
            })}
            {!filteredSortedLabels.length ? <div className="empty-state">No hay etiquetas con ese nombre.</div> : null}
          </div>
        </aside>

        <form className="label-config-form" onSubmit={saveLabel}>
          <div className="label-editor-head">
            <div>
              <span className="tag-pill preview" style={{ "--tag-color": form.color } as CSSProperties}>
                {form.name || "Nueva etiqueta"}
              </span>
              <h3>{form.name || "Nueva etiqueta"}</h3>
              <p>Pod&eacute;s ajustar color, estado y descripci&oacute;n. Si quer&eacute;s reemplazar una base, desactivala.</p>
            </div>
            <small>ID t&eacute;cnico: {form.slug || "se genera al guardar"}</small>
          </div>

          <div className="label-editor-grid">
            <label className="field">
              Nombre visible
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              <small>Las etiquetas base conservan su nombre del sistema.</small>
            </label>
            <label className="field">
              Descripci&oacute;n para la IA
              <textarea
                placeholder="Ej: Usar cuando el cliente esta listo para comprar y conviene derivarlo al vendedor asignado."
                value={form.instructions}
                onChange={(event) => setForm({ ...form, instructions: event.target.value })}
              />
              <small>{form.instructions.trim().split(/\s+/).filter(Boolean).length} / 25 palabras sugeridas</small>
            </label>
            <label className="field">
              Slug
              <input
                placeholder="se genera solo"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
              />
            </label>
            <label className="field">
              Orden
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
              />
            </label>
            <label className="field color-field">
              Color
              <span>
                <input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
                <input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
              </span>
            </label>
            <label className="check-field label-state-toggle">
              <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
              Etiqueta activa
            </label>
          </div>

          <div className="template-actions label-save-actions">
            {message ? <span className={message.includes("No ") ? "warn" : "ok"}>{message}</span> : null}
            <button className="primary" disabled={saving} type="submit">
              <Save size={17} />
              {saving ? "Guardando" : "Guardar etiquetas automaticas"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

const CRM_BOARD_COLUMNS = [
  { id: "destacados", title: "Destacados", status: null, consultype: null },
  { id: "nuevo", title: "NUEVO", status: "hot", consultype: "caliente" },
  { id: "contacto", title: "EN CONTACTO", status: "handoff", consultype: "en-contacto" },
  { id: "cotizado", title: "COTIZADO", status: "quoted", consultype: "cotizado" },
  { id: "cerrado", title: "CERRADO", status: "closed", consultype: "cerrado" },
  { id: "no-avanza", title: "NO AVANZA", status: "lost", consultype: "no-avanza" }
] as const;

function CrmBoardPanel({
  conversations,
  currentUser,
  favoriteIds,
  onConversationsChange,
  onToggleFavorite,
  onOpenChat,
  onOpenContact
}: {
  conversations: ConversationSummary[];
  currentUser: AppUser;
  favoriteIds: string[];
  onConversationsChange: (conversations: ConversationSummary[]) => void;
  onToggleFavorite: (conversationId: string) => void;
  onOpenChat: (conversationId: string) => void;
  onOpenContact: (contactId: string) => void;
}) {
  const [draggingId, setDraggingId] = useState("");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCards = conversations.filter((conversation) => {
    if (!canUserSeeCrmConversation(conversation, currentUser)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [conversation.display_name, conversation.phone, conversation.last_message, conversation.consultype]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });
  const highlighted = visibleCards.filter((conversation) => favoriteIds.includes(conversation.id));
  const boardColumns = CRM_BOARD_COLUMNS.map((column) => ({
    ...column,
    cards: getCrmColumnCards(column.id, visibleCards, favoriteIds)
  }));
  const boardCardIds = new Set(boardColumns.flatMap((column) => column.cards.map((conversation) => conversation.id)));
  const cardsInBoard = visibleCards.filter((conversation) => boardCardIds.has(conversation.id));

  async function moveConversationToColumn(conversationId: string, columnId: string) {
    const column = CRM_BOARD_COLUMNS.find((item) => item.id === columnId);

    if (!column?.status) {
      return;
    }

    const nextStatus = column.status;
    const nextConsultype = column.consultype;
    const previous = conversations;
    const next = conversations.map((conversation) =>
      conversation.id === conversationId
        ? { ...conversation, consultype: nextConsultype, status: nextStatus }
        : conversation
    );
    onConversationsChange(next);

    const response = await fetch("/api/conversations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId, consultype: nextConsultype, status: nextStatus })
    });

    if (!response.ok) {
      onConversationsChange(previous);
    }
  }

  async function removeConversationFromCrm(conversationId: string) {
    const conversation = conversations.find((item) => item.id === conversationId);

    if (!conversation) {
      return;
    }

    const previous = conversations;
    const next = conversations.map((item) =>
      item.id === conversationId
        ? { ...item, assigned_name: null, assigned_to: null, consultype: "otro", status: "open" }
        : item
    );
    const wasFavorite = favoriteIds.includes(conversationId);
    onConversationsChange(next);
    if (wasFavorite) {
      onToggleFavorite(conversationId);
    }

    const response = await fetch("/api/conversations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId, assignedTo: null, consultype: "otro", status: "open" })
    });

    if (!response.ok) {
      onConversationsChange(previous);
      if (wasFavorite) {
        onToggleFavorite(conversationId);
      }
    }
  }

  return (
    <section className="crm-panel">
      <div className="crm-head">
        <h2>Tablero CRM</h2>
        <p>Organiza oportunidades por estado, destaca conversaciones con estrella y mueve cards arrastrando.</p>
      </div>
      <div className="crm-stats">
        <Metric label="Cards en seguimiento" value={cardsInBoard.length} />
        <Metric label="Valor potencial" value={0} />
        <Metric label="Ticket promedio" value={0} />
        <Metric label="Destacadas" value={highlighted.length} />
      </div>
      <div className="crm-filters">
        <label>
          Buscar cards
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre del contacto, descripcion o plataforma"
            value={query}
          />
        </label>
        <label>
          Orden
          <select defaultValue="board">
            <option value="board">Orden del board</option>
          </select>
        </label>
        <button onClick={() => setQuery("")} type="button">Limpiar filtros</button>
      </div>
      <div className="crm-quick-tabs">
        {boardColumns.map((column) => (
          <button className={column.id === "destacados" ? "active" : ""} key={column.id} type="button">
            {column.title}
            {column.id === "destacados" ? <Star size={14} /> : null}
            <span>{column.cards.length}</span>
          </button>
        ))}
      </div>
      <div className="crm-board">
        {boardColumns.map((column) => (
          <section
            className={`crm-column ${draggingId ? "dragging" : ""}`}
            key={column.id}
            onDragOver={(event) => {
              if (column.status) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              const conversationId = event.dataTransfer.getData("text/plain") || draggingId;
              setDraggingId("");
              void moveConversationToColumn(conversationId, column.id);
            }}
          >
            <header>
              <small>{column.id === "destacados" ? "VISTA DESTACADA" : `TABLERO ${boardColumns.indexOf(column) + 1}`}</small>
              <strong>{column.title}</strong>
              <span>{column.cards.length} cards - $ 0</span>
            </header>
            {column.cards.length ? (
              column.cards.map((conversation) => (
                <article
                  className="crm-card"
                  draggable
                  key={`${column.id}-${conversation.id}`}
                  onDragEnd={() => setDraggingId("")}
                  onDragStart={(event) => {
                    setDraggingId(conversation.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", conversation.id);
                  }}
                >
                  <strong>{conversation.display_name || conversation.phone}</strong>
                  <div className="crm-card-tags">
                    <span>{getCrmPlatformLabel(conversation)}</span>
                    <span className={isHotCrmConversation(conversation) ? "hot" : ""}>{getCrmLabelTitle(conversation)}</span>
                  </div>
                  <div className="crm-card-meta">
                    <span>Ult: {formatMessageTime(conversation.last_message_at)}</span>
                    {conversation.assigned_name ? <span>{conversation.assigned_name}</span> : null}
                  </div>
                  <p>{conversation.last_message || "Sin descripcion comercial"}</p>
                  <div className="crm-card-actions">
                    <button onClick={() => onOpenChat(conversation.id)} type="button">Chat</button>
                    <button onClick={() => onOpenContact(conversation.contact_id)} type="button">Edit</button>
                    <select
                      aria-label="Mover card"
                      onChange={(event) => {
                        void moveConversationToColumn(conversation.id, event.target.value);
                        event.currentTarget.value = "";
                      }}
                      value=""
                    >
                      <option value="" disabled>Mover</option>
                      {CRM_BOARD_COLUMNS.filter((item) => item.status).map((item) => (
                        <option key={item.id} value={item.id}>{item.title}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    aria-label="Quitar del tablero CRM"
                    className="crm-card-star"
                    onClick={() => void removeConversationFromCrm(conversation.id)}
                    title="Quitar del tablero CRM"
                    type="button"
                  >
                    <Star size={15} />
                  </button>
                </article>
              ))
            ) : (
              <div className="crm-empty">
                {column.status ? "Arrastra cards aqui o usa Mover a si el tablero de origen y destino no entran juntos en pantalla." : "Marca una estrella en una conversacion para verla aca."}
              </div>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

function getCrmColumnCards(columnId: string, conversations: ConversationSummary[], favoriteIds: string[]) {
  const boardConversations = conversations.filter(
    (conversation) => favoriteIds.includes(conversation.id) || isCrmPipelineConversation(conversation)
  );

  if (columnId === "nuevo") {
    return boardConversations.filter((conversation) => isHotCrmConversation(conversation));
  }

  if (columnId === "destacados") {
    return boardConversations.filter((conversation) => getCrmBoardColumnId(conversation) === "destacados");
  }

  if (columnId === "contacto") {
    return boardConversations.filter((conversation) => getCrmBoardColumnId(conversation) === "contacto");
  }

  return boardConversations.filter((conversation) => getCrmBoardColumnId(conversation) === columnId);
}

function getCrmBoardColumnId(conversation: ConversationSummary) {
  if (isHotCrmConversation(conversation)) {
    return "nuevo";
  }

  if (conversation.status === "quoted") {
    return "cotizado";
  }

  if (conversation.status === "closed") {
    return "cerrado";
  }

  if (conversation.status === "lost") {
    return "no-avanza";
  }

  if (conversation.status === "handoff" || Boolean(conversation.assigned_to)) {
    return "contacto";
  }

  return "destacados";
}

function isHotCrmConversation(conversation: ConversationSummary) {
  return conversation.consultype === "caliente" || conversation.status === "hot";
}

function isCrmPipelineConversation(conversation: ConversationSummary) {
  const pipelineStatuses = new Set(["hot", "handoff", "quoted", "closed", "lost"]);
  const pipelineLabels = new Set<string>(
    CRM_BOARD_COLUMNS.flatMap((column) => (column.consultype ? [column.consultype] : []))
  );
  return pipelineStatuses.has(conversation.status) || pipelineLabels.has(conversation.consultype);
}

function isConversationUnread(conversation: ConversationSummary) {
  return Boolean(conversation.unread || conversation.unread_count > 0);
}

function canUserSeeCrmConversation(conversation: ConversationSummary, currentUser: AppUser) {
  if (conversation.assigned_to) {
    return conversation.assigned_to === currentUser.id;
  }

  return true;
}

function getCrmPlatformLabel(conversation: ConversationSummary) {
  return getConversationChannelMeta(conversation).label;
}

function getCrmLabelTitle(conversation: ConversationSummary) {
  return humanizeTemplateName(conversation.consultype || getCrmBoardColumnId(conversation));
}

function getConversationChannelMeta(conversation: Pick<ConversationSummary, "channel" | "platform" | "account_name">) {
  const rawChannel = (conversation.channel || conversation.platform || "whatsapp").toLowerCase();
  const channel = rawChannel.includes("instagram")
    ? "instagram"
    : rawChannel.includes("facebook")
      ? "facebook"
      : rawChannel.includes("tiktok")
        ? "tiktok"
        : rawChannel.includes("whatsapp")
          ? "whatsapp"
          : rawChannel || "whatsapp";
  const labels: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    tiktok: "TikTok",
    whatsapp: "WhatsApp"
  };
  const label = labels[channel] ?? humanizeTemplateName(channel);
  const accountName = conversation.account_name || "";

  return {
    accountName,
    className: `channel-${channel.replace(/[^a-z0-9-]/g, "-")}`,
    label,
    title: accountName ? `${label} - ${accountName}` : label
  };
}

function getContactPanelChannelLabel(conversation: Pick<ConversationSummary, "channel" | "platform" | "account_name">) {
  const meta = getConversationChannelMeta(conversation);
  if (meta.label.toLowerCase() === "whatsapp") {
    return meta.accountName.toLowerCase().includes("principal") ? "WhatsApp principal" : "WhatsApp";
  }

  return meta.title;
}

function getContactPanelChannelPhone(conversation: Pick<ConversationSummary, "channel" | "platform" | "account_name" | "account_phone_number">) {
  const meta = getConversationChannelMeta(conversation);
  if (conversation.account_phone_number) {
    return conversation.account_phone_number;
  }
  if (meta.label.toLowerCase() === "whatsapp" && meta.accountName.toLowerCase().includes("principal")) {
    return "+54 9 11 2739-9430";
  }

  return "";
}

function ContactsPanel({
  focusedContact,
  onContactCreated,
  onContactSaved,
  users
}: {
  focusedContact: { id: string; signal: number };
  onContactCreated: (payload: { conversationId: string; conversations: ConversationSummary[] }) => void;
  onContactSaved: (contact: ContactSummary) => void;
  users: AppUser[];
}) {
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const selected = useMemo(() => contacts.find((contact) => contact.id === selectedId) ?? contacts[0], [contacts, selectedId]);
  const [newContactForm, setNewContactForm] = useState({
    displayName: "",
    phone: "",
    templateId: "",
    sendTemplate: true
  });
  const [form, setForm] = useState({
    displayName: "",
    phone: "",
    contactType: "prospecto",
    sentiment: "neutral",
    consultype: "otro",
    assignedTo: ""
  });

  useEffect(() => {
    void loadContacts();
    void loadContactTemplates();
  }, []);

  useEffect(() => {
    if (focusedContact.id) {
      setSelectedId(focusedContact.id);
    }
  }, [focusedContact.id, focusedContact.signal]);

  useEffect(() => {
    if (!selected) {
      return;
    }

    setForm({
      displayName: selected.display_name ?? "",
      phone: selected.phone,
      contactType: selected.contact_type || "prospecto",
      sentiment: selected.sentiment || "neutral",
      consultype: selected.consultype || "otro",
      assignedTo: selected.assigned_to ?? ""
    });
  }, [selected?.id]);

  async function loadContacts(nextQuery = query) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();

    if (nextQuery.trim()) {
      params.set("q", nextQuery.trim());
    }

    const response = await fetch(`/api/contacts?${params.toString()}`);
    const payload = await readJsonResponse(response);
    setLoading(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos cargar contactos.");
      return;
    }

    const nextContacts = payload?.contacts ?? [];
    setContacts(nextContacts);

    const preferredId = focusedContact.id || selectedId;

    if (nextContacts.some((contact: ContactSummary) => contact.id === preferredId)) {
      setSelectedId(preferredId);
    } else {
      setSelectedId(nextContacts[0]?.id ?? "");
    }
  }

  async function loadContactTemplates() {
    const response = await fetch("/api/templates");
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      return;
    }

    const activeTemplates = (payload?.templates ?? []).filter((template: MessageTemplate) => template.active);
    setTemplates(activeTemplates);
    setNewContactForm((current) => ({
      ...current,
      templateId: current.templateId || pickInitialTemplateId(activeTemplates)
    }));
  }

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newContactForm.sendTemplate && !newContactForm.templateId) {
      setMessage("Selecciona una plantilla inicial.");
      return;
    }

    setCreating(true);
    setMessage("");

    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: newContactForm.displayName,
        phone: newContactForm.phone,
        templateId: newContactForm.sendTemplate ? newContactForm.templateId : undefined
      })
    });
    const payload = await readJsonResponse(response);
    setCreating(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos crear el contacto.");
      return;
    }

    setContacts(payload?.contacts ?? contacts);
    setSelectedId(payload?.contactId ?? "");
    setNewContactForm({
      displayName: "",
      phone: "",
      templateId: pickInitialTemplateId(templates),
      sendTemplate: true
    });
    setMessage(newContactForm.sendTemplate ? "Contacto creado y plantilla enviada." : "Contacto creado.");
    onContactCreated({
      conversationId: payload.conversationId,
      conversations: payload?.conversations ?? []
    });
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) {
      return;
    }

    setSaving(true);
    setMessage("");
    const response = await fetch("/api/contacts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contactId: selected.id,
        displayName: form.displayName,
        phone: form.phone,
        contactType: form.contactType,
        sentiment: form.sentiment,
        consultype: form.consultype,
        assignedTo: form.assignedTo || null
      })
    });
    const payload = await readJsonResponse(response);
    setSaving(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos guardar el contacto.");
      return;
    }

    const nextContacts = payload?.contacts ?? [];
    setContacts(nextContacts);
    const savedContact = nextContacts.find((contact: ContactSummary) => contact.id === selected.id);
    if (savedContact) {
      onContactSaved(savedContact);
    }
    setMessage("Contacto guardado.");
  }

  function searchContacts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadContacts(query);
  }

  return (
    <section className="contacts-manager">
      <div className="contacts-list-panel">
        <div className="panel-title">
          <UsersRound size={18} />
          Contactos
          <span>{contacts.length}</span>
        </div>
        <form className="contacts-search" onSubmit={searchContacts}>
          <label className="search-field">
            <Search size={16} />
            <input
              placeholder="Buscar nombre o telefono"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="secondary" disabled={loading} type="submit">
            <Search size={16} />
          </button>
        </form>
        <div className="contacts-list">
          {contacts.map((contact) => (
            <button
              className={`contact-row ${contact.id === selected?.id ? "active" : ""}`}
              key={contact.id}
              onClick={() => setSelectedId(contact.id)}
              type="button"
            >
              <span className="row-main">
                <strong>{contact.display_name || contact.phone}</strong>
                <small>{contact.phone}</small>
              </span>
              <span className={`tag ${contact.consultype}`}>{contact.consultype}</span>
            </button>
          ))}
          {!contacts.length ? <div className="empty-state">{loading ? "Cargando contactos..." : "No encontramos contactos."}</div> : null}
        </div>
      </div>

      <div className="contact-editor">
        <form className="admin-form new-contact-card" onSubmit={createContact}>
          <div className="panel-title compact">
            <UserPlus size={18} />
            Nuevo contacto
          </div>
          <div className="form-grid">
            <label className="field">
              Nombre y apellido
              <input
                placeholder="Ej: Carlos Gomez"
                value={newContactForm.displayName}
                onChange={(event) => setNewContactForm({ ...newContactForm, displayName: event.target.value })}
              />
            </label>
            <label className="field">
              WhatsApp
              <input
                placeholder="549..."
                required
                value={newContactForm.phone}
                onChange={(event) => setNewContactForm({ ...newContactForm, phone: event.target.value })}
              />
            </label>
            <label className="field wide">
              Plantilla inicial
              <select
                disabled={!newContactForm.sendTemplate || !templates.length}
                value={newContactForm.templateId}
                onChange={(event) => setNewContactForm({ ...newContactForm, templateId: event.target.value })}
              >
                {!templates.length ? <option value="">No hay plantillas activas</option> : null}
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label} / {template.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="check-line">
            <input
              checked={newContactForm.sendTemplate}
              onChange={(event) => setNewContactForm({ ...newContactForm, sendTemplate: event.target.checked })}
              type="checkbox"
            />
            Enviar plantilla inicial para activar WhatsApp
          </label>
          <button className="primary" disabled={creating} type="submit">
            <SendHorizonal size={17} />
            {creating ? "Creando" : "Crear y activar"}
          </button>
          {!templates.length ? <span className="warn inline">Primero sincroniza o carga una plantilla activa.</span> : null}
        </form>

        {selected ? (
          <form className="admin-form" onSubmit={saveContact}>
            <div className="panel-title">
              <UsersRound size={18} />
              Datos del contacto
            </div>
            <div className="form-grid">
              <label className="field">
                Nombre
                <input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
              </label>
              <label className="field">
                WhatsApp
                <input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </label>
              <label className="field">
                Tipo
                <select value={form.contactType} onChange={(event) => setForm({ ...form, contactType: event.target.value })}>
                  <option value="prospecto">Prospecto</option>
                  <option value="cliente">Cliente</option>
                  <option value="revendedor">Revendedor</option>
                  <option value="tecnico">Tecnico</option>
                </select>
              </label>
              <label className="field">
                Etiqueta
                <select value={form.consultype} onChange={(event) => setForm({ ...form, consultype: event.target.value })}>
                  {CONSULTYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Sentimiento
                <select value={form.sentiment} onChange={(event) => setForm({ ...form, sentiment: event.target.value })}>
                  <option value="positivo">Positivo</option>
                  <option value="neutral">Neutral</option>
                  <option value="preocupado">Preocupado</option>
                  <option value="molesto">Molesto</option>
                </select>
              </label>
              <label className="field">
                Asignado a
                <select value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}>
                  <option value="">Sin asignar</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="contact-meta">
              <span>Origen: {selected.imported_from || selected.source || "manual"}</span>
              <span>Ultimo contacto: {formatMessageTime(selected.last_seen_at)}</span>
            </div>
            <button className="primary" disabled={saving} type="submit">
              <Save size={17} />
              {saving ? "Guardando" : "Guardar datos"}
            </button>
            {message ? <span className={message.includes("guardado") ? "ok inline" : "warn"}>{message}</span> : null}
          </form>
        ) : (
          <div className="empty-state">Selecciona un contacto.</div>
        )}
      </div>
    </section>
  );
}

function pickInitialTemplateId(templates: MessageTemplate[]) {
  const phoneCallTemplate = templates.find((template) => {
    const key = normalizeTemplateSearchKey(`${template.label} ${template.name}`);
    return key.includes("llamo") && key.includes("telefono");
  });

  if (phoneCallTemplate) {
    return phoneCallTemplate.id;
  }

  const preferred = templates.find((template) => {
    const key = normalizeTemplateSearchKey(`${template.label} ${template.name}`);
    return key.includes("inicial") || key.includes("inicio") || key.includes("hola");
  });

  return preferred?.id ?? templates[0]?.id ?? "";
}

function normalizeTemplateSearchKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getScheduledTemplateStatusLabel(status: ScheduledTemplateMessage["status"]) {
  const labels: Record<ScheduledTemplateMessage["status"], string> = {
    cancelled: "cancelada",
    failed: "fallida",
    pending: "pendiente",
    processing: "procesando",
    sent: "enviada"
  };

  return labels[status] ?? status;
}

function TemplatesPanel({ currentUser }: { currentUser: AppUser }) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [scheduledTemplates, setScheduledTemplates] = useState<ScheduledTemplateMessage[]>([]);
  const [automationRules, setAutomationRules] = useState<TemplateAutomationRule[]>([]);
  const [activeTab, setActiveTab] = useState<"list" | "edit" | "scheduled" | "automation" | "window24">("scheduled");
  const [selectedAutomationState, setSelectedAutomationState] = useState("comparador");
  const [form, setForm] = useState({
    label: "",
    name: "",
    languageCode: "es_AR",
    category: "utility",
    body: "",
    active: true
  });
  const [automationForm, setAutomationForm] = useState({
    id: "",
    name: "",
    consultype: "comparador",
    templateId: "",
    delayAmount: 1,
    delayUnit: "days" as "minutes" | "hours" | "days",
    bodyParameters: "",
    active: true
  });
  const [scheduleForm, setScheduleForm] = useState({
    phone: "",
    displayName: "",
    templateId: "",
    parameters: "",
    scheduledAt: ""
  });
  const [bulkTemplates, setBulkTemplates] = useState("");
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [importingTemplates, setImportingTemplates] = useState(false);
  const [schedulingTemplate, setSchedulingTemplate] = useState(false);
  const [savingAutomationRule, setSavingAutomationRule] = useState(false);
  const [window24Config, setWindow24Config] = useState({ delayHours: 21, text: "Hola! 👋 Te escribimos desde Febecos. ¿Pudiste ver los datos del equipo que te compartimos? Si tenés alguna duda o querés que un asesor te ayude a elegir la bomba solar ideal para tu campo, estamos por acá. 😊" });
  const [window24Saving, setWindow24Saving] = useState(false);
  const [window24Loaded, setWindow24Loaded] = useState(false);
  const [message, setMessage] = useState("");
  const isAdmin = currentUser.role === "admin";
  const automationRulesByState = useMemo(() => {
    const groups = new Map<string, TemplateAutomationRule[]>();

    for (const rule of automationRules) {
      const key = rule.consultype || "otro";
      groups.set(key, [...(groups.get(key) ?? []), rule]);
    }

    return groups;
  }, [automationRules]);
  const selectedAutomationRules = automationRulesByState.get(selectedAutomationState) ?? [];

  useEffect(() => {
    void loadTemplates();
    void loadScheduledTemplates();
    void loadAutomationRules();
    void loadWindow24Config();
  }, []);

  async function loadWindow24Config() {
    const response = await fetch("/api/settings/window24-followup");
    const payload = await readJsonResponse(response);
    if (response.ok && payload?.config) {
      setWindow24Config(payload.config);
    }
    setWindow24Loaded(true);
  }

  async function saveWindow24Config(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWindow24Saving(true);
    await fetch("/api/settings/window24-followup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(window24Config)
    });
    setWindow24Saving(false);
  }

  async function loadTemplates() {
    const response = await fetch("/api/templates");
    const payload = await readJsonResponse(response);

    if (response.ok) {
      setTemplates(payload?.templates ?? []);
      setScheduleForm((current) => ({
        ...current,
        templateId: current.templateId || pickInitialTemplateId(payload?.templates ?? [])
      }));
      setAutomationForm((current) => ({
        ...current,
        templateId: current.templateId || pickInitialTemplateId(payload?.templates ?? [])
      }));
    }
  }

  async function loadAutomationRules() {
    const response = await fetch("/api/template-automation-rules");
    const payload = await readJsonResponse(response);

    if (response.ok) {
      setAutomationRules(payload?.rules ?? []);
      setAutomationForm((current) => ({
        ...current,
        templateId: current.templateId || pickInitialTemplateId(payload?.templates ?? templates)
      }));
    }
  }

  async function loadScheduledTemplates() {
    const response = await fetch("/api/scheduled-templates");
    const payload = await readJsonResponse(response);

    if (response.ok) {
      setScheduledTemplates(payload?.scheduled ?? []);
    }
  }

  async function deleteScheduledTemplate(id: string) {
    const response = await fetch(`/api/scheduled-templates?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos eliminar el envio programado.");
      return;
    }

    setScheduledTemplates(payload?.scheduled ?? []);
    setMessage("Envio programado eliminado.");
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      setMessage("Solo administrador puede crear o editar plantillas.");
      return;
    }

    setMessage("");
    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos guardar la plantilla.");
      return;
    }

    setTemplates(payload?.templates ?? []);
    setForm({ label: "", name: "", languageCode: "es_AR", category: "utility", body: "", active: true });
    setMessage("Plantilla guardada.");
  }

  async function syncMetaTemplates() {
    if (!isAdmin) {
      setMessage("Solo administrador puede sincronizar Meta.");
      return;
    }

    setMessage("");
    setSyncingTemplates(true);
    const response = await fetch("/api/templates/sync", { method: "POST" });
    const payload = await readJsonResponse(response);
    setSyncingTemplates(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos sincronizar Meta.");
      return;
    }

    setTemplates(payload?.templates ?? []);
    setMessage(`Sincronizadas ${payload?.imported ?? 0} plantillas desde Meta.`);
  }

  async function importBulkTemplates() {
    if (!isAdmin) {
      setMessage("Solo administrador puede importar plantillas.");
      return;
    }

    setMessage("");
    const parsedTemplates = parseBulkTemplates(bulkTemplates);

    if (!parsedTemplates.length) {
      setMessage("Pega al menos una plantilla. Formato: nombre_meta | idioma | nombre interno | categoria | texto");
      return;
    }

    setImportingTemplates(true);
    const response = await fetch("/api/templates/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templates: parsedTemplates })
    });
    const payload = await readJsonResponse(response);
    setImportingTemplates(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos importar las plantillas.");
      return;
    }

    setTemplates(payload?.templates ?? []);
    setBulkTemplates("");
    setMessage(`Importadas ${payload?.imported ?? parsedTemplates.length} plantillas.`);
  }

  async function scheduleTemplateFromPanel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scheduledAtIso = getArgentinaScheduledIso(scheduleForm.scheduledAt);

    if (!scheduleForm.phone.trim() || !scheduleForm.templateId || !scheduledAtIso) {
      setMessage("Carga WhatsApp, plantilla y una fecha futura en hora Argentina.");
      return;
    }

    setMessage("");
    setSchedulingTemplate(true);
    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: scheduleForm.phone,
        displayName: scheduleForm.displayName || undefined,
        templateId: scheduleForm.templateId,
        parameters: scheduleForm.parameters
          .split(/\r?\n|,/)
          .map((value) => value.trim())
          .filter(Boolean),
        scheduledAt: scheduledAtIso
      })
    });
    const payload = await readJsonResponse(response);
    setSchedulingTemplate(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos programar la plantilla.");
      return;
    }

    setScheduleForm({
      phone: "",
      displayName: "",
      templateId: scheduleForm.templateId,
      parameters: "",
      scheduledAt: ""
    });
    setMessage("Plantilla programada.");
    await loadScheduledTemplates();
  }

  async function saveAutomationRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAdmin) {
      setMessage("Solo administrador puede configurar automatizaciones.");
      return;
    }

    if (!automationForm.templateId) {
      setMessage("Selecciona una plantilla para la automatizacion.");
      return;
    }

    setMessage("");
    setSavingAutomationRule(true);
    const response = await fetch("/api/template-automation-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "upsert",
        id: automationForm.id || undefined,
        name: automationForm.name,
        consultype: automationForm.consultype,
        templateId: automationForm.templateId,
        delayAmount: Number(automationForm.delayAmount),
        delayUnit: automationForm.delayUnit,
        bodyParameters: automationForm.bodyParameters
          .split(/\r?\n|,/)
          .map((value) => value.trim())
          .filter(Boolean),
        active: automationForm.active
      })
    });
    const payload = await readJsonResponse(response);
    setSavingAutomationRule(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos guardar la automatizacion.");
      return;
    }

    setAutomationRules(payload?.rules ?? []);
    setAutomationForm({
      id: "",
      name: "",
      consultype: automationForm.consultype,
      templateId: automationForm.templateId,
      delayAmount: 1,
      delayUnit: "days",
      bodyParameters: "",
      active: true
    });
    setMessage("Automatizacion guardada.");
  }

  function editAutomationRule(rule: TemplateAutomationRule) {
    setAutomationForm({
      id: rule.id,
      name: rule.name,
      consultype: rule.consultype,
      templateId: rule.template_id,
      delayAmount: rule.delay_amount,
      delayUnit: rule.delay_unit,
      bodyParameters: rule.body_parameters.join("\n"),
      active: rule.active
    });
    setSelectedAutomationState(rule.consultype);
    setActiveTab("automation");
  }

  function newAutomationRuleForState(consultype = selectedAutomationState) {
    setSelectedAutomationState(consultype);
    setAutomationForm({
      id: "",
      name: `${humanizeTemplateName(consultype)} - `,
      consultype,
      templateId: automationForm.templateId || pickInitialTemplateId(templates),
      delayAmount: 1,
      delayUnit: "days",
      bodyParameters: "",
      active: true
    });
    setMessage("");
  }

  async function disableAutomationRule(id: string) {
    if (!isAdmin) {
      setMessage("Solo administrador puede desactivar automatizaciones.");
      return;
    }

    setMessage("");
    const response = await fetch("/api/template-automation-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "disable", id })
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos desactivar la automatizacion.");
      return;
    }

    setAutomationRules(payload?.rules ?? []);
    setMessage("Automatizacion desactivada.");
  }

  return (
    <section className="admin-panel templates-panel">
      <div className="panel-title compact-panel-title">
        <MessageSquareText size={16} />
        Seguimiento
        <span>{templates.length}</span>
      </div>
      <div className="settings-tabs compact-tabs">
        <button className={activeTab === "scheduled" ? "active" : ""} onClick={() => setActiveTab("scheduled")} type="button">
          <Clock3 size={16} /> Envíos programados
        </button>
        <button className={activeTab === "list" ? "active" : ""} onClick={() => setActiveTab("list")} type="button">
          <MessageSquareText size={16} /> Listado de plantillas
        </button>
        {isAdmin ? (
          <button className={activeTab === "automation" ? "active" : ""} onClick={() => setActiveTab("automation")} type="button">
            <BellRing size={16} /> Automatizacion por estado
          </button>
        ) : null}
        {isAdmin ? (
          <button className={activeTab === "window24" ? "active" : ""} onClick={() => setActiveTab("window24")} type="button">
            <Timer size={16} /> Seguimiento 24hs
          </button>
        ) : null}
        {isAdmin ? (
          <button className={activeTab === "edit" ? "active" : ""} onClick={() => setActiveTab("edit")} type="button">
            <RefreshCcw size={16} /> Sincronizar / crear
          </button>
        ) : null}
      </div>

      {activeTab === "scheduled" ? (
        <>
          <form className="template-form" onSubmit={scheduleTemplateFromPanel}>
            <div className="form-grid">
              <label className="field">
                WhatsApp
                <input
                  placeholder="549..."
                  value={scheduleForm.phone}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, phone: event.target.value })}
                  required
                />
              </label>
              <label className="field">
                Nombre
                <input
                  placeholder="Nombre del contacto"
                  value={scheduleForm.displayName}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, displayName: event.target.value })}
                />
              </label>
              <label className="field">
                Fecha y hora
                <input
                  type="datetime-local"
                  value={scheduleForm.scheduledAt}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, scheduledAt: event.target.value })}
                  required
                />
              </label>
              <label className="field">
                Plantilla
                <select
                  value={scheduleForm.templateId}
                  onChange={(event) => setScheduleForm({ ...scheduleForm, templateId: event.target.value })}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {templates.filter((template) => template.active).map((template) => (
                    <option key={template.id} value={template.id}>{template.label} / {template.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              Variables del body
              <textarea
                placeholder="Una variable por línea o separadas por coma"
                value={scheduleForm.parameters}
                onChange={(event) => setScheduleForm({ ...scheduleForm, parameters: event.target.value })}
              />
            </label>
            <div className="template-actions">
              <button className="primary" disabled={schedulingTemplate} type="submit">
                <Calendar size={18} />
                {schedulingTemplate ? "Programando" : "Programar envío"}
              </button>
              <button className="secondary" onClick={() => void loadScheduledTemplates()} type="button">
                <RefreshCcw size={17} />
                Actualizar listado
              </button>
              <small>Hora Argentina</small>
            </div>
          </form>
          <div className="template-list scheduled-template-list">
            {scheduledTemplates.length ? scheduledTemplates.map((item) => (
              <div className={`template-row scheduled-${item.status}`} key={item.id}>
                <div className="scheduled-template-body">
                  <strong>{item.template_label}</strong>
                  <span>{item.phone} - {formatMessageTime(item.scheduled_at)}</span>
                  <small>
                    {getScheduledTemplateStatusLabel(item.status)} - {item.created_by_name ?? "Usuario"}
                    {" - "}{item.template_name} / {item.template_language_code}
                    {item.body_parameters.length ? ` - Variables: ${item.body_parameters.join(", ")}` : ""}
                    {item.error ? ` - ${item.error}` : ""}
                  </small>
                </div>
                <button
                  className="danger scheduled-delete"
                  disabled={!["pending", "failed"].includes(item.status)}
                  onClick={() => void deleteScheduledTemplate(item.id)}
                  title={["pending", "failed"].includes(item.status) ? "Eliminar envio programado" : "No se puede eliminar un envio ya procesado"}
                  type="button"
                >
                  <Trash2 size={15} />
                  Eliminar
                </button>
              </div>
            )) : <div className="empty-state">No hay plantillas programadas todavía.</div>}
          </div>
        </>
      ) : null}

      {activeTab === "list" ? (
        <div className="template-list">
          {templates.map((template) => (
            <div className="template-row" key={template.id}>
              <strong>{template.label}</strong>
              <span>{template.name} - {template.language_code}</span>
              <small>{template.active ? "activa" : "inactiva"} - {template.body || "Sin texto local"}</small>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === "automation" && isAdmin ? (
        <div className="automation-workspace">
          <aside className="automation-state-list">
            <div className="automation-column-head">
              <strong>Estados</strong>
              <small>{automationRules.length} reglas</small>
            </div>
            {TEMPLATE_AUTOMATION_CONSULTYPES.map((consultype) => {
              const stateRules = automationRulesByState.get(consultype) ?? [];
              return (
                <button
                  className={selectedAutomationState === consultype ? "active" : ""}
                  key={consultype}
                  onClick={() => {
                    setSelectedAutomationState(consultype);
                    if (!automationForm.id) {
                      setAutomationForm((current) => ({ ...current, consultype }));
                    }
                  }}
                  type="button"
                >
                  <span>{humanizeTemplateName(consultype)}</span>
                  <small>{stateRules.length}</small>
                </button>
              );
            })}
          </aside>

          <section className="automation-rules-column">
            <div className="automation-column-head">
              <div>
                <strong>{humanizeTemplateName(selectedAutomationState)}</strong>
                <small>Reglas dentro de este estado</small>
              </div>
              <button className="secondary" onClick={() => newAutomationRuleForState()} type="button">
                <UserPlus size={14} />
                Agregar
              </button>
            </div>
            <div className="automation-rule-list">
              {selectedAutomationRules.length ? selectedAutomationRules.map((rule) => (
                <article className={`automation-rule-card ${automationForm.id === rule.id ? "active" : ""}`} key={rule.id}>
                  <button onClick={() => editAutomationRule(rule)} type="button">
                    <strong>{rule.name}</strong>
                    <span>{rule.template_label}</span>
                    <small>{rule.delay_amount} {rule.delay_unit} - {rule.active ? "activa" : "inactiva"}</small>
                  </button>
                  <button className="danger icon-only" disabled={!rule.active} onClick={() => void disableAutomationRule(rule.id)} title="Desactivar" type="button">
                    <Trash2 size={14} />
                  </button>
                </article>
              )) : <div className="empty-state compact">No hay reglas para este estado.</div>}
            </div>
          </section>

          <form className="template-form automation-rule-form" onSubmit={saveAutomationRule}>
            <div className="automation-column-head">
              <div>
                <strong>{automationForm.id ? "Editar regla" : "Nueva regla"}</strong>
                <small>{humanizeTemplateName(automationForm.consultype || selectedAutomationState)}</small>
              </div>
            </div>
            <label className="field">
              Nombre de regla
              <input
                placeholder={`${humanizeTemplateName(selectedAutomationState)} - seguimiento`}
                value={automationForm.name}
                onChange={(event) => setAutomationForm({ ...automationForm, name: event.target.value })}
                required
              />
            </label>
            <label className="field">
              Estado del contacto
              <select
                value={automationForm.consultype}
                onChange={(event) => {
                  setSelectedAutomationState(event.target.value);
                  setAutomationForm({ ...automationForm, consultype: event.target.value });
                }}
                required
              >
                {TEMPLATE_AUTOMATION_CONSULTYPES.map((value) => (
                  <option key={value} value={value}>{humanizeTemplateName(value)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Plantilla
              <select
                value={automationForm.templateId}
                onChange={(event) => setAutomationForm({ ...automationForm, templateId: event.target.value })}
                required
              >
                <option value="">Seleccionar...</option>
                {templates.filter((template) => template.active).map((template) => (
                  <option key={template.id} value={template.id}>{template.label} / {template.name}</option>
                ))}
              </select>
            </label>
            <div className="automation-delay-grid">
              <label className="field">
                Demora
                <input
                  min={0}
                  type="number"
                  value={automationForm.delayAmount}
                  onChange={(event) => setAutomationForm({ ...automationForm, delayAmount: Number(event.target.value) })}
                  required
                />
              </label>
              <label className="field">
                Unidad
                <select
                  value={automationForm.delayUnit}
                  onChange={(event) => setAutomationForm({ ...automationForm, delayUnit: event.target.value as "minutes" | "hours" | "days" })}
                >
                  <option value="minutes">Minutos</option>
                  <option value="hours">Horas</option>
                  <option value="days">Dias</option>
                </select>
              </label>
            </div>
            <label className="field">
              Variables del body
              <textarea
                placeholder="Una variable por linea o separadas por coma"
                value={automationForm.bodyParameters}
                onChange={(event) => setAutomationForm({ ...automationForm, bodyParameters: event.target.value })}
              />
            </label>
            <label className="check-field">
              <input checked={automationForm.active} onChange={(event) => setAutomationForm({ ...automationForm, active: event.target.checked })} type="checkbox" />
              Activa
            </label>
            <div className="template-actions">
              <button className="primary" disabled={savingAutomationRule} type="submit">
                <Save size={15} />
                {savingAutomationRule ? "Guardando" : automationForm.id ? "Actualizar" : "Guardar"}
              </button>
              <button className="secondary" onClick={() => newAutomationRuleForState()} type="button">
                <RefreshCcw size={14} />
                Nueva
              </button>
            </div>
            {message ? <span className={message.includes("No ") ? "warn" : "ok"}>{message}</span> : null}
          </form>
        </div>
      ) : null}

      {activeTab === "window24" && isAdmin ? (
        <div className="window24-panel">
          <div className="window24-header">
            <Timer size={18} />
            <div>
              <strong>Seguimiento automático — Ventana 24hs</strong>
              <p>Se envía un mensaje de texto libre (sin template aprobado) a los contactos con etiqueta <b>Lead Publi</b> que no respondieron después del tiempo indicado. El cron corre cada hora.</p>
            </div>
          </div>
          <form className="window24-form" onSubmit={saveWindow24Config}>
            <label className="field">
              <span>Horas sin respuesta del cliente para disparar el seguimiento</span>
              <input
                type="number"
                min={1}
                max={23}
                value={window24Config.delayHours}
                onChange={(e) => setWindow24Config(c => ({ ...c, delayHours: Number(e.target.value) }))}
              />
            </label>
            <label className="field">
              <span>Texto del mensaje de seguimiento</span>
              <textarea
                rows={5}
                value={window24Config.text}
                onChange={(e) => setWindow24Config(c => ({ ...c, text: e.target.value }))}
              />
            </label>
            <div className="window24-actions">
              <button type="submit" className="btn-primary" disabled={window24Saving}>
                {window24Saving ? "Guardando…" : "Guardar configuración"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {activeTab === "edit" && isAdmin ? (
        <>
          <div className="template-sync">
            <button className="secondary" disabled={syncingTemplates} onClick={syncMetaTemplates} type="button">
              <RefreshCcw size={17} />
              {syncingTemplates ? "Sincronizando" : "Sincronizar Meta"}
            </button>
            <textarea
              onChange={(event) => setBulkTemplates(event.target.value)}
              placeholder="Carga masiva: nombre_meta | idioma | nombre interno | categoria | texto"
              value={bulkTemplates}
            />
            <button className="secondary" disabled={importingTemplates || !bulkTemplates.trim()} onClick={importBulkTemplates} type="button">
              <Save size={17} />
              {importingTemplates ? "Importando" : "Importar lote"}
            </button>
          </div>
          <form className="template-form" onSubmit={saveTemplate}>
            <div className="form-grid">
              <label className="field">
                Nombre interno
                <input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} required />
              </label>
              <label className="field">
                Nombre Meta
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </label>
              <label className="field">
                Idioma
                <input value={form.languageCode} onChange={(event) => setForm({ ...form, languageCode: event.target.value })} required />
              </label>
              <label className="field">
                Categoria
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                  <option value="utility">Utility</option>
                  <option value="marketing">Marketing</option>
                  <option value="authentication">Authentication</option>
                </select>
              </label>
            </div>
            <label className="field">
              Texto de referencia
              <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
            </label>
            <label className="check-field">
              <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
              Activa
            </label>
            <button className="primary" type="submit">
              <Save size={18} />
              Guardar plantilla
            </button>
          </form>
        </>
      ) : null}
      {message && activeTab !== "automation" ? <span className={message.includes("No ") ? "warn" : "ok"}>{message}</span> : null}
    </section>
  );
}

function AdminUsersPanel({
  currentUser,
  initialUsers
}: {
  currentUser: AppUser;
  initialUsers: UserAdminSummary[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    role: "vendedor" as AppUser["role"],
    sales_group: true,
    active: true
  });
  const [newCode, setNewCode] = useState("");
  const [message, setMessage] = useState("");

  async function saveUser(input: {
    id?: string;
    fullName: string;
    email: string;
    role: AppUser["role"];
    salesGroup: boolean;
    salesPriority?: number;
    active: boolean;
    code?: string;
  }) {
    setMessage("");
    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      setMessage(payload?.error ?? "No pudimos guardar el usuario.");
      return false;
    }

    setUsers(payload.users ?? []);
    setMessage("Usuario guardado.");
    return true;
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await saveUser({
      fullName: newUser.full_name,
      email: newUser.email,
      role: newUser.role,
      salesGroup: newUser.sales_group,
      active: newUser.active,
      code: newCode
    });

    if (ok) {
      setNewUser({ full_name: "", email: "", role: "vendedor", sales_group: true, active: true });
      setNewCode("");
    }
  }

  return (
    <section className="admin-panel">
      <div className="panel-title">
        <ShieldCheck size={18} />
        Usuarios y accesos
        <span>{users.length}</span>
      </div>
      <div className="user-grid">
        {users.map((user) => (
          <UserEditor currentUserId={currentUser.id} key={user.id} onSave={saveUser} user={user} />
        ))}

        <form className="user-card user-form" onSubmit={createUser}>
          <div className="user-card-head">
            <UserPlus size={18} />
            <strong>Nuevo usuario</strong>
          </div>
          <label className="field">
            Nombre
            <input
              value={newUser.full_name}
              onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })}
              required
            />
          </label>
          <label className="field">
            Email
            <input
              type="email"
              value={newUser.email}
              onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
              required
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Rol
              <select
                onChange={(event) => setNewUser({ ...newUser, role: event.target.value as AppUser["role"] })}
                value={newUser.role}
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label className="field">
              Codigo
              <input
                minLength={4}
                type="password"
                value={newCode}
                onChange={(event) => setNewCode(event.target.value)}
                required
              />
            </label>
          </div>
          <label className="check-field">
            <input
              checked={newUser.sales_group}
              onChange={(event) => setNewUser({ ...newUser, sales_group: event.target.checked })}
              type="checkbox"
            />
            Grupo de ventas
          </label>
          <button className="primary" type="submit">
            <UserPlus size={18} />
            Crear
          </button>
        </form>
      </div>
      {message ? <span className={message.includes("No ") ? "warn" : "ok"}>{message}</span> : null}
    </section>
  );
}

function UserEditor({
  currentUserId,
  onSave,
  user
}: {
  currentUserId: string;
  onSave: (input: {
    id?: string;
    fullName: string;
    email: string;
    role: AppUser["role"];
    salesGroup: boolean;
    salesPriority?: number;
    active: boolean;
    code?: string;
  }) => Promise<boolean>;
  user: UserAdminSummary;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<AppUser["role"]>(user.role);
  const [salesGroup, setSalesGroup] = useState(user.sales_group);
  const [salesPriority, setSalesPriority] = useState(user.sales_priority);
  const [active, setActive] = useState(user.active);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave({
      id: user.id,
      fullName,
      email,
      role,
      salesGroup,
      salesPriority,
      active,
      code: code.trim() || undefined
    });
    setSaving(false);

    if (ok) {
      setCode("");
    }
  }

  return (
    <form className="user-card user-form" onSubmit={submit}>
      <div className="user-card-head">
        <CircleUserRound size={18} />
        <strong>{user.full_name}</strong>
      </div>
      <span className="user-meta">
        {user.role} - {user.sales_group ? "grupo ventas" : "sin grupo"} -{" "}
        {user.has_login_code ? "codigo propio" : "codigo global"} - {user.active ? "activo" : "pausado"}
      </span>
      <label className="field">
        Nombre
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
      </label>
      <label className="field">
        Email
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <div className="form-grid">
        <label className="field">
          Rol
          <select onChange={(event) => setRole(event.target.value as AppUser["role"])} value={role}>
            <option value="vendedor">Vendedor</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <label className="field">
          Nuevo codigo
          <input
            minLength={4}
            placeholder="Dejar vacio mantiene el actual"
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
      </div>
      <div className="form-grid">
        <label className="check-field">
          <input checked={salesGroup} onChange={(event) => setSalesGroup(event.target.checked)} type="checkbox" />
          Grupo de ventas
        </label>
        <label className="field">
          Prioridad
          <input
            min={1}
            max={999}
            type="number"
            value={salesPriority}
            onChange={(event) => setSalesPriority(Number(event.target.value) || 100)}
          />
        </label>
      </div>
      <label className="check-field">
        <input
          checked={active}
          disabled={user.id === currentUserId}
          onChange={(event) => setActive(event.target.checked)}
          type="checkbox"
        />
        Usuario activo
      </label>
      <button className="secondary" disabled={saving} type="submit">
        {code ? <KeyRound size={18} /> : <Save size={18} />}
        {saving ? "Guardando" : "Guardar"}
      </button>
    </form>
  );
}

function InboxList({
  conversations,
  currentUser,
  favoriteIds,
  focusedConversation,
  labelDefinitions,
  onLabelsChange,
  onConversationsChange,
  onSetFavorite,
  resetMobileDetailSignal,
  onToggleFavorite,
  users
}: {
  conversations: ConversationSummary[];
  currentUser: AppUser;
  favoriteIds: string[];
  focusedConversation: { id: string; signal: number };
  labelDefinitions: LabelDefinition[];
  onLabelsChange: (labels: LabelDefinition[]) => void;
  onConversationsChange: (conversations: ConversationSummary[]) => void;
  onSetFavorite: (conversationId: string, active: boolean) => void;
  resetMobileDetailSignal: number;
  onToggleFavorite: (conversationId: string) => void;
  users: AppUser[];
}) {
  const [items, setItems] = useState(conversations);
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? "");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [events, setEvents] = useState<ConversationEvent[]>([]);
  const [followUps, setFollowUps] = useState<ConversationFollowUp[]>([]);
  const [dueFollowUps, setDueFollowUps] = useState<AssignedFollowUpAlert[]>([]);
  const [dismissedDueFollowUps, setDismissedDueFollowUps] = useState<string[]>([]);
  const [activeConversationTab, setActiveConversationTab] = useState<"chat" | "notes" | "tasks" | "audit">("chat");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [followUpError, setFollowUpError] = useState("");
  const [noteText, setNoteText] = useState("");
  const [followUpText, setFollowUpText] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<ConversationMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [replyFilePreviewUrl, setReplyFilePreviewUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<{ alt: string; src: string } | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyProgress, setReplyProgress] = useState("");
  const [replyError, setReplyError] = useState("");
  const [draggingFile, setDraggingFile] = useState(false);
  const [recording, setRecording] = useState(false);
  const [preparingRecording, setPreparingRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioRecorderMode, setAudioRecorderMode] = useState<AudioRecorderMode>("auto");
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [quickReplyForm, setQuickReplyForm] = useState({
    id: "",
    name: "",
    shortcut: "",
    availability: "global",
    body: ""
  });
  const [quickReplyMessage, setQuickReplyMessage] = useState("");
  const [savingQuickReply, setSavingQuickReply] = useState(false);
  const [activeQuickReplyIndex, setActiveQuickReplyIndex] = useState(0);
  const [templateComposerOpen, setTemplateComposerOpen] = useState(false);
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [conversationTagsVisible, setConversationTagsVisible] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedClassifications, setSelectedClassifications] = useState<string[]>([]);
  const [transferUserId, setTransferUserId] = useState("");
  const [chatName, setChatName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateParameters, setTemplateParameters] = useState("");
  const [templateDeliveryMode, setTemplateDeliveryMode] = useState<"now" | "scheduled">("now");
  const [templateScheduledAt, setTemplateScheduledAt] = useState("");
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");
  const [sendingManualEvent, setSendingManualEvent] = useState("");
  const [sentManualEvent, setSentManualEvent] = useState("");
  const [manualEventMessage, setManualEventMessage] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaRecorderChunksRef = useRef<Blob[]>([]);
  const recordingSamplesRef = useRef<Int16Array[]>([]);
  const recordingSampleRateRef = useRef(44100);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const messageThreadRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef(selectedId);
  const selectedTagsRef = useRef<string[]>([]);
  const selectedClassificationsRef = useRef<string[]>([]);
  const notificationAudioContextRef = useRef<AudioContext | null>(null);
  const notificationBaselineRef = useRef({
    initialized: false,
    latestByConversation: new Map<string, string>()
  });
  const dueFollowUpIdsRef = useRef<Set<string>>(new Set());
  const [notificationSoundConfig, setNotificationSoundConfig] = useState(DEFAULT_NOTIFICATION_SOUND_CONFIG);
  const [filters, setFilters] = useState({
    query: "",
    consultype: "all",
    status: "all",
    assignedTo: "all",
    unreadOnly: false
  });
  const [msgSearchResults, setMsgSearchResults] = useState<Array<{
    conversation_id: string;
    contact_id: string;
    phone: string;
    display_name: string | null;
    consultype: string | null;
    matched_body: string;
    matched_at: string;
    matched_direction: string;
    total_matches: number;
  }> | null>(null);
  const [msgSearchLoading, setMsgSearchLoading] = useState(false);
  const [contactDetailOpen, setContactDetailOpen] = useState(false);
  const [contactDetailSaving, setContactDetailSaving] = useState(false);
  const [contactDetailMessage, setContactDetailMessage] = useState("");
  const [contactDetailForm, setContactDetailForm] = useState({
    displayName: "",
    phone: "",
    notes: "",
    additional: [] as ContactAdditionalInfo[]
  });
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0], [items, selectedId]);
  const visibleDueFollowUps = useMemo(
    () => dueFollowUps.filter((followUp) => !dismissedDueFollowUps.includes(followUp.id)),
    [dismissedDueFollowUps, dueFollowUps]
  );

  useEffect(() => {
    const savedMode = window.localStorage.getItem(AUDIO_RECORDER_MODE_STORAGE_KEY);

    if (isAudioRecorderMode(savedMode)) {
      setAudioRecorderMode(savedMode);
    }
  }, []);

  useEffect(() => {
    if (!contactDetailOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContactDetailOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contactDetailOpen]);

  useEffect(() => {
    if (!selected) {
      return;
    }

    const contactInfo = getContactInfoPayload(selected.imported_payload);
    setContactDetailForm({
      displayName: selected.display_name ?? "",
      phone: selected.phone,
      notes: contactInfo.notes,
      additional: contactInfo.additional
    });
    setContactDetailMessage("");
  }, [selected?.contact_id]);
  const availableLabels = useMemo(() => {
    const bySlug = new Map<string, LabelDefinition>();

    for (const option of CONSULTYPE_OPTIONS) {
      bySlug.set(option.value, {
        slug: option.value,
        name: option.label,
        color: getFallbackLabelColor(option.value),
        instructions: "",
        active: true,
        sort_order: 100,
        created_at: "",
        updated_at: ""
      });
    }

    for (const slug of TAG_FILTERS) {
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          slug,
          name: humanizeTemplateName(slug),
          color: getFallbackLabelColor(slug),
          instructions: "",
          active: true,
          sort_order: 100,
          created_at: "",
          updated_at: ""
        });
      }
    }

    for (const label of labelDefinitions) {
      if (label.active) {
        bySlug.set(label.slug, label);
      }
    }

    return Array.from(bySlug.values()).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [labelDefinitions]);
  const activeFiltersCount =
    selectedTags.length + selectedClassifications.length + (filters.assignedTo !== "all" && filters.assignedTo !== "mine" ? 1 : 0);
  const quickReplyQuery = getQuickReplyQuery(replyText);
  const filteredLabels = useMemo(() => {
    const query = normalizeTemplateSearchKey(tagSearch);
    return availableLabels.filter((label) => {
      const haystack = normalizeTemplateSearchKey(`${label.name} ${label.slug}`);
      return !query || haystack.includes(query);
    });
  }, [availableLabels, tagSearch]);
  const labelBySlug = useMemo(() => new Map(availableLabels.map((label) => [label.slug, label])), [availableLabels]);
  const unreadConversationCount = useMemo(() => items.filter(isConversationUnread).length, [items]);
  const matchingQuickReplies = useMemo(
    () => quickReplyQuery === null ? [] : quickReplies
      .filter((reply) => {
        const query = quickReplyQuery.toLowerCase();
        return !query || reply.shortcut.toLowerCase().includes(query) || reply.name.toLowerCase().includes(query);
      })
      .slice(0, 6),
    [quickReplies, quickReplyQuery]
  );

  useEffect(() => {
    setActiveQuickReplyIndex(0);
  }, [quickReplyQuery]);

  useEffect(() => {
    if (!imagePreview) {
      return;
    }

    function handlePreviewKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setImagePreview(null);
      }
    }

    window.addEventListener("keydown", handlePreviewKeyDown);
    return () => window.removeEventListener("keydown", handlePreviewKeyDown);
  }, [imagePreview]);

  function scrollThreadToBottom() {
    if (messageThreadRef.current) {
      messageThreadRef.current.scrollTo({
        top: messageThreadRef.current.scrollHeight,
        behavior: "auto"
      });
    }

    threadEndRef.current?.scrollIntoView({ block: "end" });
  }

  function scheduleThreadScrollToBottom() {
    window.requestAnimationFrame(() => {
      scrollThreadToBottom();
      window.requestAnimationFrame(scrollThreadToBottom);
    });

    const timeoutIds = [120, 360, 900].map((delay) => window.setTimeout(scrollThreadToBottom, delay));
    return () => timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  }

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    primeNotificationBaseline(conversations);
  }, []);

  useEffect(() => {
    async function loadNotificationSettings() {
      const response = await fetch("/api/settings");
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        return;
      }

      const globalSound = normalizeNotificationSoundConfig(
        (payload?.settings ?? []).find((setting: AppSetting) => setting.key === "notification_sound")?.value
      );
      const userSounds = normalizeUserNotificationSoundMap(
        (payload?.settings ?? []).find((setting: AppSetting) => setting.key === "notification_sound_users")?.value
      );
      setNotificationSoundConfig(resolveUserNotificationSound(globalSound, userSounds[currentUser.id] ?? { mode: "default" }));
    }

    void loadNotificationSettings();
  }, [currentUser, users]);

  useEffect(() => {
    function unlockNotificationAudio() {
      void unlockInboxNotificationSound(notificationAudioContextRef).then((unlocked) => {
        if (unlocked) {
          removeUnlockListeners();
        }
      });
    }

    function removeUnlockListeners() {
      window.removeEventListener("pointerdown", unlockNotificationAudio);
      window.removeEventListener("click", unlockNotificationAudio);
      window.removeEventListener("keydown", unlockNotificationAudio);
      window.removeEventListener("touchstart", unlockNotificationAudio);
    }

    window.addEventListener("pointerdown", unlockNotificationAudio);
    window.addEventListener("click", unlockNotificationAudio);
    window.addEventListener("keydown", unlockNotificationAudio);
    window.addEventListener("touchstart", unlockNotificationAudio);

    return () => {
      removeUnlockListeners();
    };
  }, []);

  useEffect(() => {
    setMobileDetailOpen(false);
  }, [resetMobileDetailSignal]);

  useEffect(() => {
    if (!focusedConversation.id) {
      return;
    }

    setSelectedId(focusedConversation.id);
    setMobileDetailOpen(true);
    markConversationRead(focusedConversation.id);
  }, [focusedConversation.id, focusedConversation.signal]);

  useEffect(() => {
    return () => {
      stopRecorderTracks();
      clearRecordingTimer();
    };
  }, []);

  useEffect(() => {
    if (activeConversationTab !== "chat") {
      return;
    }

    return scheduleThreadScrollToBottom();
  }, [activeConversationTab, loadingMessages, messages.length, mobileDetailOpen, selected?.id]);

  useEffect(() => {
    if (!replyFile?.type.startsWith("audio/")) {
      setReplyFilePreviewUrl("");
      return;
    }

    const previewUrl = URL.createObjectURL(replyFile);
    setReplyFilePreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [replyFile]);

  useEffect(() => {
    setNoteText("");
    setNoteError("");
    setFollowUpText("");
    setFollowUpDueAt("");
    setFollowUpError("");
    setChatName(selected?.display_name || "");
    setTagPanelOpen(false);
    setSummaryOpen(false);
    setQuickRepliesOpen(false);
    setEventMenuOpen(false);
    setSentManualEvent("");
    setTransferOpen(false);
    setTransferUserId(selected?.assigned_to ?? users[0]?.id ?? "");
    setTemplateComposerOpen(false);
    void loadConversationMessages(selected?.id);
    void loadConversationNotes(selected?.id);
    void loadConversationFollowUps(selected?.id);
    void loadConversationEvents(selected?.id);
  }, [selected?.id]);

  useEffect(() => {
    void loadTemplatesForContactForm();
    void loadQuickReplies();
    void loadDueFollowUps();
  }, []);

  useEffect(() => {
    if (quickRepliesOpen) {
      void loadQuickReplies();
    }
  }, [quickRepliesOpen]);

  useEffect(() => {
    function closeMenusOnOutsideClick(event: PointerEvent) {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (event.target.closest(".row-menu, .chat-actions-menu, .tag-editor-anchor")) {
        return;
      }

      closeConversationMenus();
      setTagPanelOpen(false);
    }

    function closeFiltersOnOutsideClick(event: PointerEvent) {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (event.target.closest(".filters-popover, .filters-toggle")) {
        return;
      }

      setFiltersOpen(false);
    }

    function closeMenusOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeConversationMenus();
        setFiltersOpen(false);
        setTagPanelOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeMenusOnOutsideClick);
    document.addEventListener("pointerdown", closeFiltersOnOutsideClick);
    document.addEventListener("keydown", closeMenusOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeMenusOnOutsideClick);
      document.removeEventListener("pointerdown", closeFiltersOnOutsideClick);
      document.removeEventListener("keydown", closeMenusOnEscape);
    };
  }, []);

  useEffect(() => {
    async function refreshVisibleInbox() {
      if (sendingReply || recording) {
        return;
      }

      // No refrescar si la pestaña no esta visible: evita egress contra Neon
      // cuando el inbox queda abierto en background.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      await refreshConversations(filters, { silent: true });
      await loadConversationMessages(selectedIdRef.current, { silent: true });

      // Solo refrescar la pestania activa: antes se traian notes+tasks+audit
      // en cada ciclo, multiplicando el egress innecesariamente.
      if (activeConversationTab === "notes") {
        await loadConversationNotes(selectedIdRef.current, { silent: true });
      }
      if (activeConversationTab === "tasks") {
        await loadConversationFollowUps(selectedIdRef.current, { silent: true });
      }
      if (activeConversationTab === "audit") {
        await loadConversationEvents(selectedIdRef.current, { silent: true });
      }

      // Alerta global de seguimientos vencidos: corre siempre (no depende del tab).
      await loadDueFollowUps({ silent: true });
    }

    const intervalId = window.setInterval(() => {
      void refreshVisibleInbox();
    }, 30000);

    window.addEventListener("focus", refreshVisibleInbox);
    document.addEventListener("visibilitychange", refreshVisibleInbox);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshVisibleInbox);
      document.removeEventListener("visibilitychange", refreshVisibleInbox);
    };
  }, [activeConversationTab, filters, notificationSoundConfig, recording, sendingReply]);

  async function loadConversationMessages(conversationId?: string, options: { silent?: boolean } = {}) {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    if (!options.silent) {
      setLoadingMessages(true);
      setMessageError("");
    }

    const response = await fetch(`/api/conversation-messages?conversationId=${conversationId}`);
    const payload = await readJsonResponse(response);

    if (conversationId !== selectedIdRef.current) {
      return;
    }

    if (!options.silent) {
      setLoadingMessages(false);
    }

    if (!response.ok) {
      if (!options.silent) {
        setMessages([]);
        setMessageError(payload?.error ?? "No pudimos cargar la conversacion.");
      }
      return;
    }

    setMessages(payload?.messages ?? []);

    if (!options.silent && activeConversationTab === "chat") {
      scheduleThreadScrollToBottom();
    }
  }

  async function loadConversationNotes(conversationId?: string, options: { silent?: boolean } = {}) {
    if (!conversationId) {
      setNotes([]);
      return;
    }

    if (!options.silent) {
      setLoadingNotes(true);
      setNoteError("");
    }

    const response = await fetch(`/api/conversation-notes?conversationId=${conversationId}`);
    const payload = await readJsonResponse(response);

    if (conversationId !== selectedIdRef.current) {
      return;
    }

    if (!options.silent) {
      setLoadingNotes(false);
    }

    if (!response.ok) {
      if (!options.silent) {
        setNotes([]);
        setNoteError(payload?.error ?? "No pudimos cargar las notas.");
      }
      return;
    }

    setNotes(payload?.notes ?? []);
  }

  async function loadConversationEvents(conversationId?: string, options: { silent?: boolean } = {}) {
    if (!conversationId) {
      setEvents([]);
      return;
    }

    if (!options.silent) {
      setLoadingEvents(true);
    }

    const response = await fetch(`/api/conversation-events?conversationId=${conversationId}`);
    const payload = await readJsonResponse(response);

    if (conversationId !== selectedIdRef.current) {
      return;
    }

    if (!options.silent) {
      setLoadingEvents(false);
    }

    if (!response.ok) {
      if (!options.silent) {
        setEvents([]);
      }
      return;
    }

    setEvents(payload?.events ?? []);
  }

  async function loadConversationFollowUps(conversationId?: string, options: { silent?: boolean } = {}) {
    if (!conversationId) {
      setFollowUps([]);
      return;
    }

    if (!options.silent) {
      setLoadingFollowUps(true);
      setFollowUpError("");
    }

    const response = await fetch(`/api/conversation-followups?conversationId=${conversationId}`);
    const payload = await readJsonResponse(response);

    if (conversationId !== selectedIdRef.current) {
      return;
    }

    if (!options.silent) {
      setLoadingFollowUps(false);
    }

    if (!response.ok) {
      if (!options.silent) {
        setFollowUps([]);
        setFollowUpError(payload?.error ?? "No pudimos cargar las tareas.");
      }
      return;
    }

    setFollowUps(payload?.followUps ?? []);
  }

  async function loadDueFollowUps(options: { silent?: boolean } = {}) {
    const response = await fetch("/api/followups/due");
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      if (!options.silent) {
        setDueFollowUps([]);
      }
      return;
    }

    const nextFollowUps = (Array.isArray(payload?.followUps) ? payload.followUps : []) as AssignedFollowUpAlert[];
    const nextIds = new Set<string>(nextFollowUps.map((followUp) => followUp.id));
    const hasNewDueFollowUp = nextFollowUps.some((followUp) => !dueFollowUpIdsRef.current.has(followUp.id));
    dueFollowUpIdsRef.current = nextIds;
    setDueFollowUps(nextFollowUps);

    if (hasNewDueFollowUp) {
      void playInboxNotificationSound(notificationAudioContextRef, notificationSoundConfig);
    }
  }

  function primeNotificationBaseline(nextItems: ConversationSummary[]) {
    notificationBaselineRef.current.latestByConversation = new Map(
      nextItems.map((conversation) => [conversation.id, conversation.last_message_at])
    );
    notificationBaselineRef.current.initialized = true;
  }

  function notifyIfNewInboundConversation(nextItems: ConversationSummary[], canPlaySound: boolean) {
    const state = notificationBaselineRef.current;

    if (!state.initialized) {
      primeNotificationBaseline(nextItems);
      return;
    }

    const hasNewInbound = nextItems.some((conversation) => {
      const previousLastMessageAt = state.latestByConversation.get(conversation.id);

      return (
        conversation.last_direction === "inbound" &&
        (previousLastMessageAt === undefined || conversation.last_message_at !== previousLastMessageAt) &&
        conversation.last_message_at !== previousLastMessageAt
      );
    });

    state.latestByConversation = new Map(nextItems.map((conversation) => [conversation.id, conversation.last_message_at]));

    if (canPlaySound && hasNewInbound) {
      void playInboxNotificationSound(notificationAudioContextRef, notificationSoundConfig);
    }
  }

  async function saveConversationNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected?.id || !noteText.trim()) {
      return;
    }

    setSavingNote(true);
    setNoteError("");
    const response = await fetch("/api/conversation-notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: selected.id,
        body: noteText.trim()
      })
    });
    const payload = await readJsonResponse(response);
    setSavingNote(false);

    if (!response.ok) {
      setNoteError(payload?.error ?? "No pudimos guardar la nota.");
      return;
    }

    setNoteText("");
    setNotes(payload?.notes ?? []);
  }

  async function saveConversationFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected?.id || !followUpText.trim() || !followUpDueAt) {
      return;
    }

    setSavingFollowUp(true);
    setFollowUpError("");
    const response = await fetch("/api/conversation-followups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: selected.id,
        dueAt: new Date(followUpDueAt).toISOString(),
        reason: followUpText.trim()
      })
    });
    const payload = await readJsonResponse(response);
    setSavingFollowUp(false);

    if (!response.ok) {
      setFollowUpError(payload?.error ?? "No pudimos guardar la tarea.");
      return;
    }

    setFollowUpText("");
    setFollowUpDueAt("");
    const nextFollowUps = payload?.followUps ?? [];
    setFollowUps(nextFollowUps);
    syncConversationFollowUpCounters(selected.id, nextFollowUps);
  }

  async function updateFollowUpStatus(id: string, status: "pending" | "sent" | "cancelled") {
    if (!selected?.id) {
      return;
    }

    setFollowUpError("");
    const response = await fetch("/api/conversation-followups", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: selected.id,
        id,
        status
      })
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      setFollowUpError(payload?.error ?? "No pudimos actualizar la tarea.");
      return;
    }

    const nextFollowUps = payload?.followUps ?? [];
    setFollowUps(nextFollowUps);
    syncConversationFollowUpCounters(selected.id, nextFollowUps);
  }

  function syncConversationFollowUpCounters(conversationId: string, nextFollowUps: ConversationFollowUp[]) {
    const pendingFollowUps = nextFollowUps.filter((followUp) => followUp.status === "proposed" || followUp.status === "pending");
    const overdueFollowUps = pendingFollowUps.filter((followUp) => new Date(followUp.due_at).getTime() <= Date.now());

    setItems((current) => {
      const nextItems = current.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              pending_followups: pendingFollowUps.length,
              overdue_followups: overdueFollowUps.length
            }
          : item
      );
      onConversationsChange(nextItems);
      return nextItems;
    });
  }

  async function refreshConversations(nextFilters = filters, options: { silent?: boolean; suppressSound?: boolean } = {}) {
    const params = new URLSearchParams();

    if (nextFilters.query.trim()) {
      params.set("q", nextFilters.query.trim());
    }

    if (nextFilters.consultype !== "all" && selectedTagsRef.current.length <= 1) {
      params.set("consultype", nextFilters.consultype);
    }

    if (nextFilters.status !== "all") {
      params.set("status", nextFilters.status);
    }

    if (nextFilters.assignedTo !== "all") {
      params.set("assignedTo", nextFilters.assignedTo === "mine" ? currentUser.id : nextFilters.assignedTo);
    }

    const response = await fetch(`/api/conversations?${params.toString()}`);
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      return;
    }

    const rawItems = payload?.conversations ?? [];
    const nextItems = rawItems.filter((item: ConversationSummary) => {
      const sentimentMatches =
        !selectedClassificationsRef.current.length || selectedClassificationsRef.current.includes(item.sentiment);
      const tagMatches = !selectedTagsRef.current.length || selectedTagsRef.current.includes(item.consultype);
      const unreadMatches = !nextFilters.unreadOnly || isConversationUnread(item);
      return tagMatches && sentimentMatches && unreadMatches;
    });
    notifyIfNewInboundConversation(nextItems, options.suppressSound !== true);
    setItems(nextItems);
    onConversationsChange(nextItems);

    if (!nextItems.some((item: ConversationSummary) => item.id === selectedIdRef.current)) {
      setSelectedId(nextItems[0]?.id ?? "");
      if (!options.silent) {
        setMobileDetailOpen(false);
      }
    }
  }

  async function loadTemplatesForContactForm() {
    const response = await fetch("/api/templates");
    const payload = await readJsonResponse(response);

    if (response.ok) {
      const activeTemplates = (payload?.templates ?? []).filter((template: MessageTemplate) => template.active);
      setTemplates(activeTemplates);
      setSelectedTemplateId((current) => current || pickInitialTemplateId(activeTemplates));
    }
  }

  async function loadQuickReplies() {
    const response = await fetch("/api/quick-replies");
    const payload = await readJsonResponse(response);

    if (response.ok) {
      setQuickReplies(payload?.quickReplies ?? []);
    } else {
      setQuickReplyMessage(payload?.error ?? "No pudimos cargar respuestas rapidas.");
    }
  }

  async function saveQuickReply() {
    if (!quickReplyForm.name.trim() || !quickReplyForm.shortcut.trim() || !quickReplyForm.body.trim()) {
      setQuickReplyMessage("Completa nombre, atajo y contenido.");
      return;
    }

    setSavingQuickReply(true);
    setQuickReplyMessage("");

    const response = await fetch("/api/quick-replies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: quickReplyForm.id || undefined,
        name: quickReplyForm.name,
        shortcut: quickReplyForm.shortcut,
        availability: quickReplyForm.availability,
        body: quickReplyForm.body
      })
    });
    const payload = await readJsonResponse(response);

    setSavingQuickReply(false);

    if (!response.ok) {
      setQuickReplyMessage(payload?.error ?? "No pudimos guardar la respuesta rapida.");
      return;
    }

    setQuickReplies(payload?.quickReplies ?? []);
    resetQuickReplyForm();
    setQuickReplyMessage("Respuesta rapida guardada.");
  }

  async function deleteQuickReplyById(id: string) {
    const response = await fetch("/api/quick-replies", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id })
    });
    const payload = await readJsonResponse(response);

    if (response.ok) {
      setQuickReplies(payload?.quickReplies ?? []);
      setQuickReplyMessage("Respuesta rapida borrada.");
      return;
    }

    setQuickReplyMessage(payload?.error ?? "No pudimos borrar la respuesta rapida.");
  }

  function editQuickReply(reply: QuickReply) {
    setQuickReplyForm({
      id: reply.id,
      name: reply.name,
      shortcut: reply.shortcut,
      availability: reply.availability,
      body: reply.body
    });
    setQuickReplyMessage("");
  }

  function resetQuickReplyForm() {
    setQuickReplyForm({ id: "", name: "", shortcut: "", availability: "global", body: "" });
  }

  function insertQuickReply(reply: QuickReply) {
    setReplyText((current) => current.replace(/(^|\s)\/([^\s/]*)$/, (_match, prefix: string) => {
      const spacing = prefix || "";
      return `${spacing}${reply.body}`;
    }));
  }

  function handleReplyKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    // Enviar el mensaje con Ctrl+Enter (o Cmd+Enter en Mac) para cualquier usuario.
    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey) &&
      quickReplyQuery === null
    ) {
      event.preventDefault();
      if (!sendingReply && (replyText.trim() || replyFile)) {
        event.currentTarget.form?.requestSubmit();
      }
      return;
    }

    if (quickReplyQuery === null || !matchingQuickReplies.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveQuickReplyIndex((current) => (current + 1) % matchingQuickReplies.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveQuickReplyIndex((current) => (current - 1 + matchingQuickReplies.length) % matchingQuickReplies.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      insertQuickReply(matchingQuickReplies[activeQuickReplyIndex] ?? matchingQuickReplies[0]);
    }
  }

  async function sendTemplateToSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected?.phone || !selectedTemplateId) {
      setTemplateMessage("Elegi una plantilla para enviar.");
      return;
    }

    const scheduledAtIso = templateDeliveryMode === "scheduled" ? getArgentinaScheduledIso(templateScheduledAt) : null;

    if (templateDeliveryMode === "scheduled" && !scheduledAtIso) {
      setTemplateMessage("Elegi una fecha y hora futura de Argentina.");
      return;
    }

    setTemplateMessage("");
    setSendingTemplate(true);
    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: selected.phone,
        displayName: selected.display_name ?? undefined,
        templateId: selectedTemplateId,
        parameters: templateParameters
          .split(/\r?\n|,/)
          .map((value) => value.trim())
          .filter(Boolean),
        scheduledAt: scheduledAtIso ?? undefined
      })
    });
    const payload = await readJsonResponse(response);
    setSendingTemplate(false);

    if (!response.ok) {
      setTemplateMessage(payload?.error ?? "No pudimos enviar la plantilla.");
      return;
    }

    setItems(payload?.conversations ?? []);
    onConversationsChange(payload?.conversations ?? []);
    setSelectedId(payload?.conversationId ?? selected.id);
    setMessages(payload?.messages ?? []);
    setTemplateParameters("");
    setTemplateScheduledAt("");
    setTemplateDeliveryMode("now");
    setTemplateMessage(payload?.scheduled ? "Plantilla programada." : "Plantilla enviada.");
    await refreshConversations(filters, { silent: true });
  }

  async function sendSelectorFlowToSelected() {
    if (!selected?.id) {
      return;
    }

    setReplyError("");
    const response = await fetchWithTimeout("/api/conversation-messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: selected.id,
        kind: "selector-flow"
      })
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      setReplyError(payload?.error ?? "No pudimos enviar el selector de WhatsApp.");
      return;
    }

    setMessages(payload?.messages ?? []);
    setEventMenuOpen(false);
    await refreshConversations(filters, { silent: true });
  }

  async function sendManualEventToSelected(eventName: "manual_selector_febecos" | "manual_purchase" | "manual_lead") {
    if (!selected?.id) {
      return;
    }

    setSendingManualEvent(eventName);
    setSentManualEvent("");
    setManualEventMessage("");
    setReplyError("");

    const response = await fetch("/api/conversation-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: selected.id,
        event: eventName
      })
    });
    const payload = await readJsonResponse(response);
    setSendingManualEvent("");

    if (!response.ok) {
      setManualEventMessage(payload?.error ?? "No pudimos enviar el evento manual.");
      return;
    }

    setEvents(payload?.events ?? []);
    setActiveConversationTab("audit");
    setSentManualEvent(eventName);
    setManualEventMessage("");
  }

  function updateFilters(next: Partial<typeof filters>) {
    const nextFilters = { ...filters, ...next };
    setFilters(nextFilters);
    // Limpiar resultados de búsqueda en mensajes al cambiar filtros
    if (next.query === "" || next.query === undefined) {
      setMsgSearchResults(null);
    }
    void refreshConversations(nextFilters);
  }

  async function searchInMessages(q: string) {
    if (!q.trim() || q.trim().length < 2) return;
    setMsgSearchLoading(true);
    setMsgSearchResults(null);
    try {
      const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json() as { results?: typeof msgSearchResults };
      setMsgSearchResults(data.results ?? []);
    } catch {
      setMsgSearchResults([]);
    } finally {
      setMsgSearchLoading(false);
    }
  }

  function toggleSelectedTag(tagName: string) {
    setSelectedTags((current) => {
      const nextTags = current.includes(tagName) ? current.filter((value) => value !== tagName) : [...current, tagName];
      selectedTagsRef.current = nextTags;
      const nextFilters = { ...filters, consultype: nextTags.length === 1 ? nextTags[0] : "all" };
      setFilters(nextFilters);
      window.setTimeout(() => void refreshConversations(nextFilters), 0);
      return nextTags;
    });
  }

  function toggleSelectedClassification(sentiment: string) {
    setSelectedClassifications((current) => {
      const nextClassifications =
        current.includes(sentiment) ? current.filter((value) => value !== sentiment) : [...current, sentiment];
      selectedClassificationsRef.current = nextClassifications;
      window.setTimeout(() => void refreshConversations(filters), 0);
      return nextClassifications;
    });
  }

  function toggleAllTags() {
    setSelectedTags((current) => {
      const allTags = availableLabels.map((label) => label.slug);
      const nextTags = current.length === allTags.length ? [] : allTags;
      selectedTagsRef.current = nextTags;
      const nextFilters = { ...filters, consultype: nextTags.length === 1 ? nextTags[0] : "all" };
      setFilters(nextFilters);
      window.setTimeout(() => void refreshConversations(nextFilters), 0);
      return nextTags;
    });
  }

  async function patchConversation(conversationId: string, body: Record<string, unknown>) {
    const listScrollTop = document.querySelector<HTMLElement>(".conversation-list")?.scrollTop ?? 0;
    const threadScrollTop = messageThreadRef.current?.scrollTop ?? 0;
    const response = await fetch("/api/conversations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId, ...body })
    });

    if (!response.ok) {
      return;
    }

    if (typeof body.aiEnabled === "boolean" && Object.keys(body).length === 1) {
      setItems((current) => {
        const nextItems = current.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, ai_enabled: Boolean(body.aiEnabled) } : conversation
        );
        onConversationsChange(nextItems);
        return nextItems;
      });
      restoreConversationScroll(listScrollTop, threadScrollTop);
      return;
    }

    if (typeof body.unread === "boolean" && Object.keys(body).length === 1) {
      restoreConversationScroll(listScrollTop, threadScrollTop);
      return;
    }

    await refreshConversations();
    restoreConversationScroll(listScrollTop, threadScrollTop);
    if (conversationId === selected?.id) {
      await loadConversationMessages(conversationId);
      await loadConversationNotes(conversationId, { silent: true });
      restoreConversationScroll(listScrollTop, threadScrollTop);
    }
  }

  function restoreConversationScroll(listScrollTop: number, threadScrollTop: number) {
    window.requestAnimationFrame(() => {
      const list = document.querySelector<HTMLElement>(".conversation-list");
      if (list) {
        list.scrollTop = listScrollTop;
      }

      if (messageThreadRef.current) {
        messageThreadRef.current.scrollTop = threadScrollTop;
      }
    });
  }

  function selectConversation(conversationId: string) {
    setSelectedId(conversationId);
    setMobileDetailOpen(true);
    markConversationRead(conversationId);
  }

  function openDueFollowUp(followUp: AssignedFollowUpAlert) {
    setDismissedDueFollowUps((current) => current.includes(followUp.id) ? current : [...current, followUp.id]);
    setSelectedId(followUp.conversation_id);
    setActiveConversationTab("tasks");
    setMobileDetailOpen(true);
  }

  function markConversationUnread(conversationId: string) {
    setItems((current) => {
      const nextItems = current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unread: true, unread_count: 1 } : conversation
      );
      onConversationsChange(nextItems);
      return nextItems;
    });
    void patchConversation(conversationId, { unread: true });
  }

  function markConversationRead(conversationId: string) {
    const target = items.find((conversation) => conversation.id === conversationId);
    if (!target?.unread && !target?.unread_count) {
      return;
    }

    setItems((current) => {
      const nextItems = current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unread: false, unread_count: 0 } : conversation
      );
      onConversationsChange(nextItems);
      return nextItems;
    });
    void patchConversation(conversationId, { unread: false });
  }

  async function hideConversation(conversationId: string, status: "blocked" | "deleted") {
    const nextItems = items.filter((conversation) => conversation.id !== conversationId);
    setItems(nextItems);
    onConversationsChange(nextItems);
    const response = await fetch("/api/conversations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId, status })
    });

    if (!response.ok) {
      await refreshConversations(filters, { silent: true });
      return;
    }

    if (selectedIdRef.current === conversationId) {
      const nextSelectedId = nextItems[0]?.id ?? "";
      selectedIdRef.current = nextSelectedId;
      setSelectedId(nextSelectedId);
      setMobileDetailOpen(false);
    }

    closeConversationMenus();
  }

  async function changeConversationType(conversationId: string, consultype: string) {
    if (consultype === "caliente") {
      onSetFavorite(conversationId, true);
      await patchConversation(conversationId, { assignedTo: currentUser.id, consultype, status: "hot" });
      closeConversationMenus();
      return;
    }

    if (consultype === "comparador") {
      onSetFavorite(conversationId, false);
      await patchConversation(conversationId, { consultype, status: "open" });
      closeConversationMenus();
      return;
    }

    await patchConversation(conversationId, { consultype });
    closeConversationMenus();
  }

  async function createAndApplyLabel(name: string) {
    const trimmed = name.trim();

    if (!trimmed || !selected) {
      return;
    }

    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: trimmed,
        color: "#38bdf8",
        instructions: "Etiqueta creada desde el chat. Completar instrucciones en Configuracion de etiquetas."
      })
    });
    const payload = await readJsonResponse(response);

    if (!response.ok || !payload?.label?.slug) {
      setReplyError(payload?.error ?? "No pudimos crear la etiqueta.");
      return;
    }

    if (Array.isArray(payload?.labels)) {
      onLabelsChange(payload.labels);
    }

    setTagSearch("");
    await changeConversationType(selected.id, payload.label.slug);
  }

  function closeConversationMenus() {
    document
      .querySelectorAll<HTMLDetailsElement>(".row-menu[open], .chat-actions-menu[open], .type-submenu[open]")
      .forEach((menu) => {
        menu.open = false;
      });
  }

  async function saveChatName() {
    if (!selected?.id) {
      return;
    }

    await patchConversation(selected.id, { displayName: chatName.trim() || null });
  }

  function addContactDetailField() {
    setContactDetailForm((current) => ({
      ...current,
      additional: [
        ...current.additional,
        {
          id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
          title: "",
          value: ""
        }
      ]
    }));
  }

  function updateContactDetailField(id: string, key: "title" | "value", value: string) {
    setContactDetailForm((current) => ({
      ...current,
      additional: current.additional.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    }));
  }

  function removeContactDetailField(id: string) {
    setContactDetailForm((current) => ({
      ...current,
      additional: current.additional.filter((item) => item.id !== id)
    }));
  }

  async function saveContactDetails(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!selected?.contact_id) {
      return;
    }

    setContactDetailSaving(true);
    setContactDetailMessage("");
    const response = await fetch("/api/contacts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contactId: selected.contact_id,
        displayName: contactDetailForm.displayName.trim() || null,
        phone: contactDetailForm.phone,
        contactType: selected.contact_type || "prospecto",
        sentiment: selected.sentiment || "neutral",
        consultype: selected.consultype || "otro",
        assignedTo: selected.assigned_to || null,
        contactInfo: {
          notes: contactDetailForm.notes,
          additional: contactDetailForm.additional
        }
      })
    });
    const payload = await readJsonResponse(response);
    setContactDetailSaving(false);

    if (!response.ok) {
      setContactDetailMessage(payload?.error ?? "No pudimos guardar el contacto.");
      return;
    }

    const nextItems = payload?.conversations ?? [];
    setItems(nextItems);
    onConversationsChange(nextItems);
    setContactDetailMessage("Datos guardados.");
  }

  function resetFilters() {
    const nextFilters = { query: "", consultype: "all", status: "all", assignedTo: "all", unreadOnly: false };
    selectedTagsRef.current = [];
    selectedClassificationsRef.current = [];
    setSelectedTags([]);
    setSelectedClassifications([]);
    setFilters(nextFilters);
    void refreshConversations(nextFilters);
  }

  function buildConversationSummary() {
    const visibleMessages = messages
      .filter((message) => message.body?.trim())
      .slice(-8)
      .map((message) => `${message.direction === "inbound" ? "Cliente" : "Febo AI"}: ${message.body.trim()}`);

    if (!visibleMessages.length) {
      return "Todavia no hay suficiente historial para resumir esta conversacion.";
    }

    return `Resumen operativo de ${selected?.display_name || selected?.phone}: ${visibleMessages.join(" ")}`
      .replace(/\s+/g, " ")
      .slice(0, 900);
  }

  async function transferSelectedConversation() {
    if (!selected?.id || !transferUserId) {
      return;
    }

    await patchConversation(selected.id, {
      assignedTo: transferUserId,
      aiEnabled: false,
      status: "handoff"
    });
    setTransferOpen(false);
  }

  async function deleteMessage(messageId: string) {
    if (!window.confirm("¿Eliminar este mensaje? Solo se ocultará localmente.")) {
      return;
    }

    await fetch("/api/conversation-messages", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId })
    });

    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m));
  }

  async function saveEditedMessage(messageId: string) {
    const trimmed = editingBody.trim();

    if (!trimmed) {
      return;
    }

    await fetch("/api/conversation-messages", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId, body: trimmed })
    });

    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, body: trimmed } : m));
    setEditingMessageId(null);
    setEditingBody("");
  }

  async function sendManualReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected?.id || (!replyText.trim() && !replyFile)) {
      return;
    }

    setSendingReply(true);
    setReplyProgress(replyFile ? (getClientAttachmentMimeType(replyFile).startsWith("audio/") ? "Subiendo audio..." : "Subiendo archivo...") : "Enviando...");
    setReplyError("");
    let response: Response;

    try {
      if (replyFile && shouldUseBlobUpload(replyFile)) {
        const uploadFile = normalizeClientAttachmentFile(replyFile);
        try {
          const blob = await withTimeout(
            upload(uploadFile.name || "archivo", uploadFile, {
              access: "public",
              handleUploadUrl: "/api/blob/upload"
            }),
            MANUAL_BLOB_UPLOAD_TIMEOUT_MS,
            "La subida directa del archivo tardo demasiado."
          );

          setReplyProgress("Enviando a WhatsApp...");
          response = await fetchWithTimeout("/api/conversation-messages", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              conversationId: selected.id,
              media: {
                filename: replyFile.name || "archivo",
                mimeType: uploadFile.type || getClientAttachmentMimeType(replyFile),
                size: uploadFile.size,
                url: blob.url
              },
              text: replyText.trim() || undefined
            })
          });
        } catch (uploadError) {
          if (uploadFile.size > BACKEND_ATTACHMENT_UPLOAD_LIMIT_BYTES) {
            throw uploadError;
          }

          console.warn("Direct attachment upload failed; retrying through backend.", uploadError);
          setReplyProgress("Reintentando envio...");
          response = await fetchWithTimeout("/api/conversation-messages", {
            method: "POST",
            body: buildAttachmentFormData(selected.id, replyFile, replyText.trim())
          });
        }
      } else {
        const textPayload: Record<string, unknown> = {
          conversationId: selected.id,
          text: replyText.trim()
        };

        if (replyingTo) {
          textPayload.replyToMessageId = replyingTo.id;

          if (replyingTo.wa_message_id) {
            textPayload.replyToWaMessageId = replyingTo.wa_message_id;
          }
        }

        const body =
          replyFile ?
            buildAttachmentFormData(selected.id, replyFile, replyText.trim())
          : JSON.stringify(textPayload);

        setReplyProgress("Enviando...");
        response = await fetchWithTimeout("/api/conversation-messages", {
          method: "POST",
          headers: replyFile ? undefined : { "content-type": "application/json" },
          body
        });
      }
    } catch (error) {
      setSendingReply(false);
      setReplyProgress("");
      setReplyError(error instanceof Error ? error.message : "No pudimos enviar el mensaje.");
      return;
    }

    const payload = await readJsonResponse(response);

    setSendingReply(false);
    setReplyProgress("");

    if (!response.ok) {
      setReplyError(getReplySendError(response, payload));
      return;
    }

    setReplyText("");
    setReplyFile(null);
    setReplyingTo(null);
    setMessages(markLatestManualReply(payload?.messages ?? [], currentUser));
    await refreshConversations();
  }

  function setAttachment(file?: File | null) {
    setReplyError("");

    if (!file) {
      setReplyFile(null);
      return;
    }

    if (!isSupportedClientAttachment(file)) {
      setReplyError("Formato no compatible. Usa imagen, video MP4/3GP, PDF, Office o audio M4A/AAC/MP3/OGG compatible.");
      return;
    }

    const maxBytes = getClientAttachmentMaxBytes(file);
    if (file.size > maxBytes) {
      setReplyError(`El archivo supera ${formatMegabytes(maxBytes)} MB.`);
      return;
    }

    setReplyFile(file);
  }

  function isFileDrag(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function handleConversationDragOver(event: DragEvent<HTMLElement>) {
    if (!isFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDraggingFile(true);
  }

  function handleConversationDragLeave(event: DragEvent<HTMLElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setDraggingFile(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDraggingFile(false);
    setActiveConversationTab("chat");
    setAttachment(event.dataTransfer.files?.[0] ?? null);
  }

  function updateAudioRecorderMode(mode: AudioRecorderMode) {
    setAudioRecorderMode(mode);
    window.localStorage.setItem(AUDIO_RECORDER_MODE_STORAGE_KEY, mode);
  }

  async function startRecording() {
    setReplyError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setReplyError("Este navegador no permite grabar audio directo. Proba con Adjuntar.");
      return;
    }

    try {
      const useVeryCompatibleRecorder = audioRecorderMode === "very-compatible";
      const usePcmRecorder =
        audioRecorderMode === "compatible" ||
        useVeryCompatibleRecorder ||
        (audioRecorderMode === "auto" && shouldUsePcmRecorderForDevice());
      const compatibleAudioConstraints: MediaTrackConstraints = useVeryCompatibleRecorder
        ? {
            autoGainControl: false,
            channelCount: { ideal: 1, max: 1 },
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: { ideal: PCM_RECORDING_TARGET_SAMPLE_RATE },
            sampleSize: { ideal: 16 }
          }
        : {
            autoGainControl: true,
            channelCount: { ideal: 1 },
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: { ideal: PCM_RECORDING_TARGET_SAMPLE_RATE }
          };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: usePcmRecorder
          ? compatibleAudioConstraints
          : {
              autoGainControl: true,
              echoCancellation: true,
              noiseSuppression: true
            }
      });
      recordingStreamRef.current = stream;
      const mediaRecorderMimeType = getSupportedRecordingMimeType();

      if (mediaRecorderMimeType && typeof MediaRecorder !== "undefined" && !usePcmRecorder) {
        const recorder = new MediaRecorder(stream, { mimeType: mediaRecorderMimeType });
        mediaRecorderRef.current = recorder;
        mediaRecorderChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            mediaRecorderChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          finishMediaRecorderAudio(recorder.mimeType || mediaRecorderMimeType);
        };

        recorder.start();
        markRecordingStarted();
        return;
      }

      const AudioContextConstructor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextConstructor) {
        setReplyError("Este navegador no permite preparar audio directo. Proba con Adjuntar.");
        stopRecorderTracks();
        return;
      }

      const audioContext = usePcmRecorder ? new AudioContextConstructor({ sampleRate: PCM_RECORDING_TARGET_SAMPLE_RATE }) : new AudioContextConstructor();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(useVeryCompatibleRecorder ? 32768 : usePcmRecorder ? 16384 : 4096, 1, 1);

      recordingSamplesRef.current = [];
      recordingSampleRateRef.current = audioContext.sampleRate;
      audioContextRef.current = audioContext;
      audioSourceRef.current = source;
      audioProcessorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const output = event.outputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);

        for (let index = 0; index < input.length; index += 1) {
          const sample = Math.max(-1, Math.min(1, input[index]));
          pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }

        output.fill(0);
        recordingSamplesRef.current.push(pcm);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      markRecordingStarted();
    } catch {
      setReplyError("No pudimos acceder al microfono. Revisa permisos del navegador.");
      stopRecorderTracks();
      clearRecordingTimer();
      setRecording(false);
      setPreparingRecording(false);
    }
  }

  function markRecordingStarted() {
    setReplyFile(null);
    setPreparingRecording(false);
    setRecording(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      clearRecordingTimer();
      setRecording(false);
      setPreparingRecording(true);
      setReplyError("");
      recorder.stop();
      return;
    }

    const samples = [...recordingSamplesRef.current];
    const sampleRate = recordingSampleRateRef.current;

    stopRecorderTracks();
    clearRecordingTimer();
    setRecording(false);
    setPreparingRecording(true);
    setReplyError("");

    window.setTimeout(() => {
      try {
        const file = buildWavRecordingFile(samples, sampleRate);

        if (file) {
          setAttachment(file);
          setReplyText("");
        } else {
          setReplyError("No se detecto audio grabado. Proba grabar dos segundos y detener.");
        }
      } catch {
        setReplyError("No pudimos preparar el audio grabado. Proba de nuevo o adjunta un audio.");
      } finally {
        setPreparingRecording(false);
      }
    }, 0);
  }

  function stopRecorderTracks() {
    mediaRecorderRef.current = null;
    mediaRecorderChunksRef.current = [];
    audioProcessorRef.current?.disconnect();
    audioProcessorRef.current = null;
    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    recordingSamplesRef.current = [];
  }

  function finishMediaRecorderAudio(mimeType: string) {
    try {
      const chunks = mediaRecorderChunksRef.current;
      if (!chunks.length) {
        setReplyError("No se detecto audio grabado. Proba grabar dos segundos y detener.");
        return;
      }

      const normalizedMimeType = mimeType.split(";")[0].trim().toLowerCase() || "audio/mp4";
      const extension = getRecordingExtension(normalizedMimeType);
      const file = new File(chunks, `audio-febo-${Date.now()}.${extension}`, { type: normalizedMimeType });
      setAttachment(file);
      setReplyText("");
    } catch {
      setReplyError("No pudimos preparar el audio grabado. Proba de nuevo o adjunta un audio.");
    } finally {
      setPreparingRecording(false);
      stopRecorderTracks();
    }
  }

  function clearRecordingTimer() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  return (
    <div className={`inbox-panel ${mobileDetailOpen ? "show-detail" : "show-list"}`}>
      {visibleDueFollowUps.length ? (
        <div className="followup-alert-stack" role="status">
          {visibleDueFollowUps.slice(0, 3).map((followUp) => (
            <article className="followup-alert" key={followUp.id}>
              <Clock3 size={18} />
              <div>
                <strong>Seguimiento activo</strong>
                <p>{followUp.display_name || followUp.phone || "Contacto"}: {followUp.reason}</p>
                <small>{formatMessageTime(followUp.due_at)}</small>
              </div>
              <button className="primary" onClick={() => openDueFollowUp(followUp)} type="button">
                Ver
              </button>
              <button
                className="secondary"
                onClick={() => setDismissedDueFollowUps((current) => current.includes(followUp.id) ? current : [...current, followUp.id])}
                type="button"
              >
                Cerrar
              </button>
            </article>
          ))}
        </div>
      ) : null}
      <div className="conversation-list">
        <div className="conversation-list-sticky">
          <div className="panel-title">
            Conversaciones
          </div>
          <div className="list-tabs">
            <label className="conversation-scope-control">
              <select
                aria-label="Alcance de conversaciones"
                value={filters.assignedTo === "mine" ? "mine" : "all"}
                onChange={(event) => updateFilters({ assignedTo: event.target.value === "mine" ? "mine" : "all" })}
              >
                <option value="all">Todos</option>
                <option value="mine">Mis chats</option>
              </select>
              <ChevronDown size={15} />
            </label>
            <button className={filters.unreadOnly ? "active" : ""} onClick={() => updateFilters({ status: "all", unreadOnly: !filters.unreadOnly })} type="button">
              <BellRing size={16} />
              No leidos
              {unreadConversationCount ? <span>{unreadConversationCount}</span> : null}
            </button>
            <button className={`filters-toggle icon-only ${filtersOpen ? "open" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)} title="Filtros" type="button">
              <Filter size={17} />
              {activeFiltersCount ? <span>{activeFiltersCount}</span> : null}
            </button>
            <button
              className={`tag-visibility-toggle icon-only ${conversationTagsVisible ? "active" : ""}`}
              onClick={() => setConversationTagsVisible((visible) => !visible)}
              title={conversationTagsVisible ? "Ocultar etiquetas" : "Mostrar etiquetas"}
              type="button"
            >
              <Tags size={17} />
            </button>
          </div>
          <div className="list-quick-actions">
            <label className="search-field">
              <Search size={16} />
              <input
                className="inbox-search"
                placeholder="Buscar"
                value={filters.query}
                onChange={(event) => {
                  updateFilters({ query: event.target.value });
                  if (!event.target.value.trim()) setMsgSearchResults(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && filters.query.trim().length >= 2) {
                    void searchInMessages(filters.query);
                  }
                }}
              />
              {filters.query.trim().length >= 2 && (
                <button
                  className="msg-search-btn"
                  title="Buscar esta frase en todos los mensajes (Enter)"
                  type="button"
                  onClick={() => void searchInMessages(filters.query)}
                >
                  {msgSearchLoading ? "…" : <MessageSquareText size={14} />}
                </button>
              )}
            </label>
            {msgSearchResults !== null && (
              <div className="msg-search-results">
                <div className="msg-search-header">
                  <span>
                    {msgSearchResults.length === 0
                      ? "Sin resultados en mensajes"
                      : `${msgSearchResults.length} conversación${msgSearchResults.length !== 1 ? "es" : ""} con "${filters.query}"`}
                  </span>
                  <button type="button" onClick={() => setMsgSearchResults(null)}><X size={14} /></button>
                </div>
                {msgSearchResults.map((r) => (
                  <button
                    className="msg-search-row"
                    key={r.conversation_id}
                    type="button"
                    onClick={() => {
                      setMsgSearchResults(null);
                      setSelectedId(r.conversation_id);
                    }}
                  >
                    <strong>{r.display_name || r.phone}</strong>
                    {r.total_matches > 1 && <span className="match-count">{r.total_matches}</span>}
                    <p className="match-snippet">{r.matched_body.slice(0, 120)}{r.matched_body.length > 120 ? "…" : ""}</p>
                    <small>{formatMessageTime(r.matched_at)}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          {filtersOpen ? (
            <div className="filters-popover">
            <div className="filters-head">
              <strong>Filtros</strong>
              <button onClick={resetFilters} type="button">Limpiar</button>
            </div>
            <div className="filter-group">
              <span>CLASIFICACION</span>
              {SENTIMENT_FILTERS.map((sentiment) => (
                <label className={selectedClassifications.includes(sentiment) ? "selected" : ""} key={sentiment}>
                  <input
                    checked={selectedClassifications.includes(sentiment)}
                    onChange={() => toggleSelectedClassification(sentiment)}
                    type="checkbox"
                  />
                  {sentiment}
                </label>
              ))}
            </div>
            <div className="filter-group">
              <span>CONSULTYPE</span>
              {CONSULTYPE_OPTIONS.map((option) => (
                <label className={selectedTags.includes(option.value) ? "selected" : ""} key={option.value}>
                  <input
                    checked={selectedTags.includes(option.value)}
                    onChange={() => toggleSelectedTag(option.value)}
                    type="checkbox"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <div className="filter-group">
              <span>VENDEDOR</span>
              <label className={filters.assignedTo === "all" ? "selected" : ""}>
                <input
                  checked={filters.assignedTo === "all"}
                  onChange={() => updateFilters({ assignedTo: "all" })}
                  type="radio"
                />
                Todos
              </label>
              <label className={filters.assignedTo === "mine" ? "selected" : ""}>
                <input
                  checked={filters.assignedTo === "mine"}
                  onChange={() => updateFilters({ assignedTo: "mine" })}
                  type="radio"
                />
                Mis conversaciones
              </label>
              <label className={filters.assignedTo === "unassigned" ? "selected" : ""}>
                <input
                  checked={filters.assignedTo === "unassigned"}
                  onChange={() => updateFilters({ assignedTo: "unassigned" })}
                  type="radio"
                />
                Sin asignar
              </label>
              {users.map((user) => (
                <label className={filters.assignedTo === user.id ? "selected" : ""} key={user.id}>
                  <input
                    checked={filters.assignedTo === user.id}
                    onChange={() => updateFilters({ assignedTo: user.id })}
                    type="radio"
                  />
                  {user.full_name}
                </label>
              ))}
            </div>
            <div className="filter-group">
              <span>ETIQUETAS</span>
              <label className={selectedTags.length === availableLabels.length ? "selected" : ""}>
                <input
                  checked={selectedTags.length === availableLabels.length}
                  onChange={toggleAllTags}
                  type="checkbox"
                />
                Todas
              </label>
              {availableLabels.map((label) => (
                <label className={selectedTags.includes(label.slug) ? "selected" : ""} key={label.slug}>
                  <input
                    checked={selectedTags.includes(label.slug)}
                    onChange={() => toggleSelectedTag(label.slug)}
                    type="checkbox"
                  />
                  {label.name}
                </label>
              ))}
            </div>
          </div>
          ) : null}
        </div>
        {items.length ? (
          items.map((conversation) => {
            const channelMeta = getConversationChannelMeta(conversation);

            return (
            <article
              className={`conversation-row ${conversation.id === selected?.id ? "active" : ""} ${isConversationUnread(conversation) ? "unread" : ""}`}
              key={conversation.id}
            >
              <button
                className="conversation-row-main"
                onClick={() => selectConversation(conversation.id)}
                type="button"
              >
                <span className="row-meta">
                  <span className={`channel-pill ${channelMeta.className}`} title={channelMeta.title}>{channelMeta.label}</span>
                  <time>{formatListDate(conversation.last_message_at)}</time>
                </span>
                <strong>{conversation.display_name || conversation.phone}</strong>
                <small>Sentimiento: {conversation.sentiment || "neutro"}</small>
                {conversationTagsVisible ? (
                  <span className={`tag ${conversation.consultype}`}>{labelBySlug.get(conversation.consultype)?.name ?? getConsultypeLabel(conversation.consultype)}</span>
                ) : null}
                {conversation.pending_followups ? (
                  <span className={`followup-pill ${conversation.overdue_followups ? "due" : ""}`}>
                    <Clock3 size={12} />
                    {conversation.overdue_followups ? `${conversation.overdue_followups} vencida${conversation.overdue_followups > 1 ? "s" : ""}` : `${conversation.pending_followups} tarea${conversation.pending_followups > 1 ? "s" : ""}`}
                  </span>
                ) : null}
                {conversation.assigned_name ? <span className="assigned-pill">asignado: {conversation.assigned_name}</span> : null}
              </button>
              <details className="row-menu">
                <summary aria-label="Acciones"><MoreVertical size={18} /></summary>
                <div className="action-popover">
                  <button onClick={() => patchConversation(conversation.id, { assignedTo: null, status: "open" })} type="button"><CheckCheck size={15} /> Desescalar</button>
                  <button onClick={() => markConversationUnread(conversation.id)} type="button"><CircleUserRound size={15} /> Marcar como no leido</button>
                  <details className="type-submenu">
                    <summary><Tags size={15} /> Cambiar tipo</summary>
                    <div>
                      <strong>CAMBIAR TIPO</strong>
                      {availableLabels.map((option) => (
                        <button
                          className={`type-choice ${option.slug} ${conversation.consultype === option.slug ? "active" : ""}`}
                          key={option.slug}
                          onClick={() => void changeConversationType(conversation.id, option.slug)}
                          style={{ "--label-color": option.color } as CSSProperties}
                          type="button"
                        >
                          <span />
                          {option.name}
                        </button>
                      ))}
                    </div>
                  </details>
                  <button onClick={() => void hideConversation(conversation.id, "blocked")} type="button"><X size={15} /> Bloquear</button>
                  <button className="danger" onClick={() => void hideConversation(conversation.id, "deleted")} type="button"><Trash2 size={15} /> Eliminar chat</button>
                </div>
              </details>
            </article>
            );
          })
        ) : (
          <div className="empty-state">Cuando importemos Hariaz o entren mensajes, van a aparecer aca.</div>
        )}
      </div>

      <div
        className={`conversation-detail ${draggingFile ? "dragging-file" : ""} ${contactDetailOpen ? "contact-drawer-open" : ""}`}
        onDragLeave={handleConversationDragLeave}
        onDragOver={handleConversationDragOver}
        onDrop={handleDrop}
      >
        {selected ? (
          <>
            {(() => {
              const channelMeta = getConversationChannelMeta(selected);

              return (
                <>
            <button className="back-button" onClick={() => setMobileDetailOpen(false)} type="button">
              <ChevronLeft size={18} />
              Volver
            </button>
            <div className="detail-head">
              <div className="detail-channel">
                <strong className={channelMeta.className}>{channelMeta.label}</strong>
                <span>| {selected.phone}</span>
                {channelMeta.accountName ? <small>{channelMeta.accountName}</small> : null}
                <em>{selected.display_name || selected.phone}</em>
              </div>
              <div className="detail-actions">
                <button
                  className={`ia-toggle ${selected.ai_enabled ? "on" : ""}`}
                  onClick={() => patchConversation(selected.id, { aiEnabled: !selected.ai_enabled })}
                  type="button"
                >
                  <span />
                  IA Activa
                </button>
                <button
                  className={`icon-action favorite-action ${favoriteIds.includes(selected.id) ? "active" : ""}`}
                  onClick={() => onToggleFavorite(selected.id)}
                  title="Marcar/desmarcar favorito"
                  type="button"
                >
                  <Star size={18} />
                </button>
                {selected.assigned_to ? (
                  <button
                    className="warning-action"
                    onClick={() => patchConversation(selected.id, { assignedTo: null, status: "open" })}
                    title="Desasignar conversacion"
                    type="button"
                  >
                    Desasignar
                  </button>
                ) : null}
                <button className="transfer-button" onClick={() => setTransferOpen(true)} type="button">Transferir</button>
                <details className="chat-actions-menu">
                  <summary aria-label="Mas acciones"><MoreVertical size={20} /></summary>
                  <div className="action-popover">
                    <button onClick={() => patchConversation(selected.id, { assignedTo: null, status: "open" })} type="button"><CheckCheck size={15} /> Desescalar</button>
                    <button onClick={() => markConversationUnread(selected.id)} type="button"><CircleUserRound size={15} /> Marcar como no leido</button>
                    <details className="type-submenu">
                      <summary><Tags size={15} /> Cambiar tipo</summary>
                      <div>
                        <strong>CAMBIAR TIPO</strong>
                        {availableLabels.map((option) => (
                          <button
                            className={`type-choice ${option.slug} ${selected.consultype === option.slug ? "active" : ""}`}
                            key={option.slug}
                            onClick={() => void changeConversationType(selected.id, option.slug)}
                            style={{ "--label-color": option.color } as CSSProperties}
                            type="button"
                          >
                            <span />
                            {option.name}
                          </button>
                        ))}
                      </div>
                    </details>
                    <button onClick={() => void hideConversation(selected.id, "blocked")} type="button"><X size={15} /> Bloquear</button>
                    <button className="danger" onClick={() => void hideConversation(selected.id, "deleted")} type="button"><Trash2 size={15} /> Eliminar chat</button>
                  </div>
                </details>
              </div>
            </div>
                </>
              );
            })()}
            <div className="mobile-detail-name">
              <span>{selected.display_name || selected.phone}</span>
              {selected.phone ? (
                <a href={`tel:${selected.phone.replace(/\D/g, "")}`} onClick={(event) => event.stopPropagation()}>
                  {selected.phone}
                </a>
              ) : null}
            </div>

            <div className="toolbar">
              <button className="contact-open-button" onClick={() => setContactDetailOpen((open) => !open)} type="button">
                <span>Contacto</span>
                <strong>{selected.display_name || selected.phone}</strong>
              </button>
              <div className="toolbar-icons">
                <span className="tag-editor-anchor">
                  <button className="icon-action" onClick={() => setTagPanelOpen(!tagPanelOpen)} title="Editar etiqueta" type="button"><Tags size={17} /></button>
                  {tagPanelOpen ? (
                    <div className="tag-editor-panel">
                      <input
                        onChange={(event) => setTagSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && tagSearch.trim()) {
                            event.preventDefault();
                            void createAndApplyLabel(tagSearch);
                          }
                        }}
                        placeholder="Buscar o crear etiqueta..."
                        value={tagSearch}
                      />
                      {tagSearch.trim() && !filteredLabels.some((label) => normalizeTemplateSearchKey(label.name) === normalizeTemplateSearchKey(tagSearch)) ? (
                        <button className="tag-create-row" onClick={() => void createAndApplyLabel(tagSearch)} type="button">
                          <Tags size={15} />
                          Crear "{tagSearch.trim()}"
                        </button>
                      ) : null}
                      {filteredLabels.map((label) => (
                        <div className="tag-editor-row" key={label.slug}>
                          <span className="tag-dot" style={{ background: label.color }} />
                          <strong>{label.name}</strong>
                          <button
                            onClick={() => {
                              setTagPanelOpen(false);
                              setTagSearch("");
                              void changeConversationType(selected.id, label.slug);
                            }}
                            type="button"
                          >
                            {selected.consultype === label.slug ? "Actual" : "Agregar"}
                          </button>
                          <small>{label.instructions}</small>
                        </div>
                      ))}
                      {!filteredLabels.length && !tagSearch.trim() ? (
                        <div className="empty-state">No hay etiquetas activas.</div>
                      ) : null}
                    </div>
                  ) : null}
                </span>
                <button className="icon-action" onClick={() => setSummaryOpen(true)} title="Generar resumen" type="button"><ClipboardList size={17} /></button>
                <button className="icon-action active" onClick={() => setTemplateComposerOpen(true)} title="Enviar plantilla" type="button"><FilePenLine size={17} /></button>
                <button className="icon-action" onClick={() => setQuickRepliesOpen(true)} title="Respuestas rapidas" type="button"><MessageCircleMore size={17} /></button>
                <details className="event-menu" open={eventMenuOpen}>
                  <summary onClick={(event) => { event.preventDefault(); setEventMenuOpen(!eventMenuOpen); }}>
                    <Calendar size={17} />
                    Enviar evento
                    <span>3</span>
                  </summary>
                  <div>
                    <strong>ENVIAR EVENTO</strong>
                    <button className={sentManualEvent === "manual_selector_febecos" ? "event-sent" : ""} disabled={Boolean(sendingManualEvent)} onClick={() => void sendManualEventToSelected("manual_selector_febecos")} type="button">
                      <Calendar size={17} /> <span>Selector Febecos<small>Manual</small></span><b>{sendingManualEvent === "manual_selector_febecos" ? "Enviando" : sentManualEvent === "manual_selector_febecos" ? "✓ Enviado" : "Enviar"}</b>
                    </button>
                    <button className={sentManualEvent === "manual_purchase" ? "event-sent" : ""} disabled={Boolean(sendingManualEvent)} onClick={() => void sendManualEventToSelected("manual_purchase")} type="button">
                      <Calendar size={17} /> <span>Compra<small>Purchase manual</small></span><b>{sendingManualEvent === "manual_purchase" ? "Enviando" : sentManualEvent === "manual_purchase" ? "✓ Enviado" : "Enviar"}</b>
                    </button>
                    <button className={sentManualEvent === "manual_lead" ? "event-sent" : ""} disabled={Boolean(sendingManualEvent)} onClick={() => void sendManualEventToSelected("manual_lead")} type="button">
                      <Calendar size={17} /> <span>Lead<small>Manual</small></span><b>{sendingManualEvent === "manual_lead" ? "Enviando" : sentManualEvent === "manual_lead" ? "✓ Enviado" : "Enviar"}</b>
                    </button>
                    {manualEventMessage ? <em>{manualEventMessage}</em> : null}
                  </div>
                </details>
              </div>
            </div>

            {contactDetailOpen ? (
              <aside aria-label="Detalles del contacto" className="contact-detail-drawer">
                <header>
                  <div>
                    <span>Detalles del contacto</span>
                    <strong>{selected.display_name || selected.phone}</strong>
                  </div>
                  <button aria-label="Cerrar detalles" onClick={() => setContactDetailOpen(false)} type="button">
                    <X size={18} />
                  </button>
                </header>
                <form className="contact-detail-body" onSubmit={saveContactDetails}>
                  <section className="contact-profile-card">
                    <label>
                      Nombre
                      <input
                        value={contactDetailForm.displayName}
                        onChange={(event) => setContactDetailForm((current) => ({ ...current, displayName: event.target.value }))}
                        placeholder="Nombre del contacto"
                      />
                    </label>
                    <label>
                      WhatsApp
                      <input
                        value={contactDetailForm.phone}
                        onChange={(event) => setContactDetailForm((current) => ({ ...current, phone: event.target.value }))}
                        placeholder="549..."
                      />
                    </label>
                    {selected.phone ? <a href={`tel:+${selected.phone.replace(/\D/g, "")}`}>Llamar al contacto</a> : null}
                  </section>
                  <dl className="contact-detail-list">
                    <div>
                      <dt>Canal usado</dt>
                      <dd>
                        <span>{getContactPanelChannelLabel(selected)}</span>
                        {getContactPanelChannelPhone(selected) ? <small>{getContactPanelChannelPhone(selected)}</small> : null}
                      </dd>
                    </div>
                  </dl>
                  <section className="contact-extra-editor">
                    <label>
                      Informacion del contacto
                      <textarea
                        value={contactDetailForm.notes}
                        onChange={(event) => setContactDetailForm((current) => ({ ...current, notes: event.target.value }))}
                        placeholder="Notas utiles del cliente, referencias, condiciones, datos comerciales..."
                      />
                    </label>
                    <div className="contact-extra-head">
                      <strong>Informacion adicional</strong>
                      <button onClick={addContactDetailField} type="button">
                        <UserPlus size={15} />
                        Agregar
                      </button>
                    </div>
                    {contactDetailForm.additional.map((item) => (
                      <div className="contact-extra-row" key={item.id}>
                        <input
                          value={item.title}
                          onChange={(event) => updateContactDetailField(item.id, "title", event.target.value)}
                          placeholder="Titulo"
                        />
                        <input
                          value={item.value}
                          onChange={(event) => updateContactDetailField(item.id, "value", event.target.value)}
                          placeholder="Informacion"
                        />
                        <button aria-label="Eliminar dato" onClick={() => removeContactDetailField(item.id)} type="button">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </section>
                  {contactDetailMessage ? <p className={contactDetailMessage.includes("guardados") ? "ok inline" : "warn"}>{contactDetailMessage}</p> : null}
                  <button className="primary contact-save-button" disabled={contactDetailSaving} type="submit">
                    <Save size={16} />
                    {contactDetailSaving ? "Guardando" : "Guardar contacto"}
                  </button>
                </form>
              </aside>
            ) : null}

            {summaryOpen ? (
              <div className="modal-backdrop">
                <section className="dialog small-dialog">
                  <header>
                    <h3>Resumen de la conversacion</h3>
                    <button onClick={() => setSummaryOpen(false)} type="button"><X size={22} /></button>
                  </header>
                  <p>{buildConversationSummary()}</p>
                  <footer><button className="secondary" onClick={() => setSummaryOpen(false)} type="button">Cerrar</button></footer>
                </section>
              </div>
            ) : null}

            {transferOpen ? (
              <div className="modal-backdrop">
                <section className="dialog transfer-dialog">
                  <header>
                    <h3>Transferir conversacion</h3>
                    <button onClick={() => setTransferOpen(false)} type="button"><X size={22} /></button>
                  </header>
                  <label className="field">
                    Operador destino
                    <select value={transferUserId} onChange={(event) => setTransferUserId(event.target.value)}>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </label>
                  <footer>
                    <button className="secondary" onClick={() => setTransferOpen(false)} type="button">Cancelar</button>
                    <button className="primary" disabled={!transferUserId} onClick={transferSelectedConversation} type="button">Transferir</button>
                  </footer>
                </section>
              </div>
            ) : null}

            {quickRepliesOpen ? (
              <div className="modal-backdrop">
                <section className="dialog quick-dialog">
                  <header>
                    <h3>Respuestas rapidas</h3>
                    <button onClick={() => setQuickRepliesOpen(false)} type="button"><X size={22} /></button>
                  </header>
                  <div className="quick-form-grid">
                    <label className="field">
                      Nombre
                      <input
                        placeholder="Saludo Inicial"
                        value={quickReplyForm.name}
                        onChange={(event) => setQuickReplyForm({ ...quickReplyForm, name: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      Atajo (sin "/")
                      <input
                        placeholder="saludo_inicial"
                        value={quickReplyForm.shortcut}
                        onChange={(event) => setQuickReplyForm({ ...quickReplyForm, shortcut: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      Disponibilidad
                      <select
                        value={quickReplyForm.availability}
                        onChange={(event) => setQuickReplyForm({ ...quickReplyForm, availability: event.target.value })}
                      >
                        <option value="global">Global</option>
                        <option value="admin">Admin</option>
                        <option value="vendedor">Vendedor</option>
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    Contenido
                    <textarea
                      placeholder="Hola, como estas?"
                      value={quickReplyForm.body}
                      onChange={(event) => setQuickReplyForm({ ...quickReplyForm, body: event.target.value })}
                    />
                  </label>
                  <div className="template-actions">
                    <button className="primary" disabled={savingQuickReply} onClick={saveQuickReply} type="button">
                      {savingQuickReply ? "Guardando" : "Guardar"}
                    </button>
                    <button className="secondary" onClick={resetQuickReplyForm} type="button">Nuevo</button>
                    {quickReplyMessage ? <span className={quickReplyMessage.includes("No ") ? "warn" : "ok"}>{quickReplyMessage}</span> : null}
                  </div>
                  <div className="quick-table">
                    {quickReplies.length ? quickReplies.map((reply) => (
                      <div key={reply.id}>
                        <strong>{reply.name}</strong>
                        <span>/{reply.shortcut}</span>
                        <p>{reply.body}</p>
                        <button onClick={() => editQuickReply(reply)} type="button">Editar</button>
                        <button className="danger" onClick={() => void deleteQuickReplyById(reply.id)} type="button">Borrar</button>
                      </div>
                    )) : <p>No hay respuestas rapidas guardadas.</p>}
                  </div>
                  <footer><button className="secondary" onClick={() => setQuickRepliesOpen(false)} type="button">Cerrar</button></footer>
                </section>
              </div>
            ) : null}

            {templateComposerOpen ? (
              <div className="modal-backdrop">
                <form className="dialog template-dialog" onSubmit={sendTemplateToSelected}>
                  <header>
                    <h3>Enviar plantilla (WhatsApp)</h3>
                    <button onClick={() => setTemplateComposerOpen(false)} type="button"><X size={22} /></button>
                  </header>
                  <div className="template-destination">Destino: {selected.display_name || selected.phone}</div>
                  <div className="template-modal-grid">
                    <label className="field">
                      Plantilla
                      <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                        <option value="">Seleccionar...</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>{template.label} - {template.language_code}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">Idioma<input value="es_AR" readOnly /></label>
                    <label className="field">Categoria<select defaultValue="utility"><option value="utility">Utility</option></select></label>
                  </div>
                  <label className="field">
                    Variables del body
                    <textarea placeholder="Esta plantilla no requiere variables de body." value={templateParameters} onChange={(event) => setTemplateParameters(event.target.value)} />
                  </label>
                  <fieldset className="template-delivery-options">
                    <legend>Entrega</legend>
                    <label>
                      <input
                        checked={templateDeliveryMode === "now"}
                        name="templateDeliveryMode"
                        onChange={() => setTemplateDeliveryMode("now")}
                        type="radio"
                      />
                      Enviar ahora
                    </label>
                    <label>
                      <input
                        checked={templateDeliveryMode === "scheduled"}
                        name="templateDeliveryMode"
                        onChange={() => setTemplateDeliveryMode("scheduled")}
                        type="radio"
                      />
                      Programar
                    </label>
                    <input
                      aria-label="Fecha y hora programada en Argentina"
                      disabled={templateDeliveryMode !== "scheduled"}
                      onChange={(event) => setTemplateScheduledAt(event.target.value)}
                      type="datetime-local"
                      value={templateScheduledAt}
                    />
                    <small>Hora Argentina</small>
                  </fieldset>
                  <div className="template-preview">Selecciona una plantilla para ver el contenido.</div>
                  <div className="template-warning">Recorda: Marketing requiere opt-in del contacto y se contabiliza como business-initiated si pasaron 24 h.</div>
                  <footer>
                    <button className="secondary" onClick={() => setTemplateComposerOpen(false)} type="button">Cancelar</button>
                    <button className="primary" disabled={sendingTemplate || !selectedTemplateId} type="submit">
                      {sendingTemplate ? "Guardando" : templateDeliveryMode === "scheduled" ? "Programar" : "Enviar"}
                    </button>
                  </footer>
                  {templateMessage ? <span className={templateMessage.includes("enviada") || templateMessage.includes("programada") ? "ok inline" : "warn"}>{templateMessage}</span> : null}
                </form>
              </div>
            ) : null}

            <div className="conversation-tabs">
              <button
                className={activeConversationTab === "chat" ? "active" : ""}
                onClick={() => setActiveConversationTab("chat")}
                type="button"
              >
                <MessageSquareText size={17} />
                Conversacion
                <span>{messages.length}</span>
              </button>
              <button
                className={`notes-tab ${activeConversationTab === "notes" ? "active" : ""}`}
                onClick={() => setActiveConversationTab("notes")}
                type="button"
              >
                <FileText size={17} />
                Notas internas
                <span>{notes.length}</span>
              </button>
              <button
                className={activeConversationTab === "tasks" ? "active" : ""}
                onClick={() => setActiveConversationTab("tasks")}
                type="button"
              >
                <ClipboardList size={17} />
                Tareas
                <span>{followUps.filter((followUp) => followUp.status === "proposed" || followUp.status === "pending").length}</span>
              </button>
              <button
                className={activeConversationTab === "audit" ? "active" : ""}
                onClick={() => setActiveConversationTab("audit")}
                type="button"
              >
                <ShieldCheck size={17} />
                Auditoria
                <span>{events.length}</span>
              </button>
            </div>

            <div className={`conversation-workspace ${activeConversationTab === "notes" ? "show-notes" : ""} ${activeConversationTab === "tasks" ? "show-tasks" : ""} ${activeConversationTab === "audit" ? "show-audit" : ""}`}>
              <div className="thread-panel">
                {loadingMessages ? <div className="empty-state">Cargando mensajes...</div> : null}
                {messageError ? <div className="empty-state warn">{messageError}</div> : null}
                {!loadingMessages && !messageError && messages.length ? (
                  <div className="message-thread" ref={messageThreadRef}>
                    {messages.map((message) => {
                      const authorLabel = getMessageAuthorLabel(message);
                      const isHumanOutbound = isHumanOutboundMessage(message);
                      const isEditing = editingMessageId === message.id;

                      return (
                        <article
                          className={`chat-bubble ${message.direction} ${isHumanOutbound ? "human-outbound" : ""} ${isAudioMessage(message) ? "audio-bubble" : ""}`}
                          key={message.id}
                        >
                          <div className="message-actions">
                            {message.direction === "outbound" && !message.deleted_at && (
                              <>
                                <button
                                  aria-label="Editar mensaje"
                                  onClick={() => { setEditingMessageId(message.id); setEditingBody(message.body); }}
                                  title="Editar"
                                  type="button"
                                >
                                  <FilePenLine size={13} />
                                </button>
                                <button
                                  aria-label="Eliminar mensaje"
                                  onClick={() => deleteMessage(message.id)}
                                  title="Eliminar"
                                  type="button"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                            {message.direction === "inbound" && (
                              <button
                                aria-label="Responder mensaje"
                                onClick={() => setReplyingTo(message)}
                                type="button"
                              >
                                <MessageCircleMore size={13} />
                                Responder
                              </button>
                            )}
                          </div>
                          {message.reply_to_body ? (
                            <div className="reply-preview">
                              <span>{message.reply_to_body}</span>
                            </div>
                          ) : null}
                          {message.deleted_at ? (
                            <em className="msg-deleted">Mensaje eliminado</em>
                          ) : isEditing ? (
                            <div className="msg-edit-area">
                              <textarea
                                autoFocus
                                onChange={(e) => setEditingBody(e.target.value)}
                                value={editingBody}
                              />
                              <div className="msg-edit-actions">
                                <button className="primary" onClick={() => saveEditedMessage(message.id)} type="button">Guardar</button>
                                <button className="secondary" onClick={() => { setEditingMessageId(null); setEditingBody(""); }} type="button">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {!isAudioMessage(message) && message.body ? <p>{message.body}</p> : null}
                            </>
                          )}
                          {getReplyOptions(message).length ? (
                            <div className="reply-options-log">
                              <span>Opciones enviadas:</span>
                              {getReplyOptions(message).map((option) => (
                                <b key={`${message.id}-${option.id}`}>{option.title}</b>
                              ))}
                            </div>
                          ) : null}
                          {message.media_id ? <MessageMedia message={message} onImageOpen={setImagePreview} /> : null}
                          <small>
                            {authorLabel} - {formatMessageTime(message.created_at)}
                          </small>
                          {message.direction === "outbound" && message.whatsapp_status ? <DeliveryStatus message={message} /> : null}
                        </article>
                      );
                    })}
                    <div ref={threadEndRef} />
                  </div>
                ) : null}
                {!loadingMessages && !messageError && !messages.length ? (
                  <div className="empty-state">Contacto importado sin historial de conversacion.</div>
                ) : null}
              </div>
              {imagePreview ? (
                <div className="modal-backdrop image-preview-backdrop" onClick={() => setImagePreview(null)}>
                  <div className="image-preview-dialog" onClick={(event) => event.stopPropagation()}>
                    <button aria-label="Cerrar imagen" className="image-preview-close" onClick={() => setImagePreview(null)} type="button">
                      <X size={22} />
                    </button>
                    <img alt={imagePreview.alt} src={imagePreview.src} />
                  </div>
                </div>
              ) : null}
              <div className="notes-panel">
                {loadingNotes ? <div className="empty-state">Cargando notas...</div> : null}
                {!loadingNotes && notes.length ? (
                  <div className="notes-list">
                    {notes.map((note) => (
                      <article className="note-card" key={note.id}>
                        <p>{note.body}</p>
                        <small>
                          {note.created_by_name ?? "Usuario"} - {formatMessageTime(note.created_at)}
                        </small>
                      </article>
                    ))}
                  </div>
                ) : null}
                {!loadingNotes && !notes.length ? <div className="empty-state">Sin notas internas todavia.</div> : null}
                <form className="note-composer" onSubmit={saveConversationNote}>
                  <textarea
                    disabled={savingNote}
                    onChange={(event) => setNoteText(event.target.value)}
                    placeholder="Nota interna para vendedores. No se envia al cliente."
                    value={noteText}
                  />
                  <div className="template-actions">
                    <button className="primary" disabled={savingNote || !noteText.trim()} type="submit">
                      <Save size={17} />
                      {savingNote ? "Guardando" : "Guardar nota"}
                    </button>
                  </div>
                  {noteError ? <span className="warn">{noteError}</span> : null}
                </form>
              </div>
              <div className="tasks-panel">
                {loadingFollowUps ? <div className="empty-state">Cargando tareas...</div> : null}
                {!loadingFollowUps && followUps.length ? (
                  <div className="task-list">
                    {followUps.map((followUp) => (
                      <article className={`task-card ${followUp.status}`} key={followUp.id}>
                        <div>
                          <strong>{followUp.reason}</strong>
                          <small>
                            {formatMessageTime(followUp.due_at)} - {getFollowUpStatusLabel(followUp.status)}
                            {followUp.created_by_name ? ` - ${followUp.created_by_name}` : ""}
                          </small>
                        </div>
                        {followUp.status === "proposed" || followUp.status === "pending" ? (
                          <div className="task-actions">
                            {followUp.status === "proposed" ? (
                              <button className="secondary" onClick={() => updateFollowUpStatus(followUp.id, "pending")} type="button">
                                Aceptar
                              </button>
                            ) : null}
                            <button className="primary" onClick={() => updateFollowUpStatus(followUp.id, "sent")} type="button">
                              Hecho
                            </button>
                            <button className="secondary danger" onClick={() => updateFollowUpStatus(followUp.id, "cancelled")} type="button">
                              Cancelar
                            </button>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : null}
                {!loadingFollowUps && !followUps.length ? <div className="empty-state">Sin tareas o seguimientos todavia.</div> : null}
                <form className="task-composer" onSubmit={saveConversationFollowUp}>
                  <textarea
                    disabled={savingFollowUp}
                    onChange={(event) => setFollowUpText(event.target.value)}
                    placeholder="Ej: llamar para confirmar pago o revisar disponibilidad."
                    value={followUpText}
                  />
                  <div className="task-composer-row">
                    <input
                      disabled={savingFollowUp}
                      onChange={(event) => setFollowUpDueAt(event.target.value)}
                      type="datetime-local"
                      value={followUpDueAt}
                    />
                    <button className="primary" disabled={savingFollowUp || !followUpText.trim() || !followUpDueAt} type="submit">
                      <Calendar size={17} />
                      {savingFollowUp ? "Guardando" : "Crear tarea"}
                    </button>
                  </div>
                  {followUpError ? <span className="warn">{followUpError}</span> : null}
                </form>
              </div>
              <div className="audit-panel">
                {loadingEvents ? <div className="empty-state">Cargando auditoria...</div> : null}
                {!loadingEvents && events.length ? (
                  <div className="audit-list">
                    {events.map((event) => (
                      <article className="audit-card" key={event.id}>
                        <strong>{getConversationEventTitle(event)}</strong>
                        <p>{getConversationEventDescription(event)}</p>
                        <small>{formatMessageTime(event.created_at)}</small>
                      </article>
                    ))}
                  </div>
                ) : null}
                {!loadingEvents && !events.length ? <div className="empty-state">Sin eventos automaticos todavia.</div> : null}
              </div>
            </div>

            {activeConversationTab === "chat" ? (
              <form
              className="reply-composer"
              onSubmit={sendManualReply}
            >
              <input
                accept="image/png,image/jpeg,image/webp,video/mp4,video/3gpp,audio/aac,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm,.mp4,.3gp,.m4a,.aac,.mp3,.ogg,.wav,.webm,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                hidden
                onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                ref={attachmentInputRef}
                type="file"
              />
              {replyingTo ? (
                <div className="reply-bar">
                  <span className="reply-bar-text">{replyingTo.body}</span>
                  <button aria-label="Cancelar respuesta" onClick={() => setReplyingTo(null)} type="button">
                    <X size={14} />
                  </button>
                </div>
              ) : null}
              <div className="drop-zone">
                <Paperclip size={18} />
                <span>Solta aca una imagen, video, PDF o archivo</span>
              </div>
              {recording ? <div className="recording-pill">Grabando {formatRecordingSeconds(recordingSeconds)}</div> : null}
              {preparingRecording ? <div className="recording-pill preparing">Preparando audio...</div> : null}
              {replyFile ? (
                <div className="attachment-draft">
                  {replyFile.type.startsWith("image/") ? <ImageIcon size={16} /> : <FileText size={16} />}
                  <div className="attachment-draft-body">
                    <span>{replyFile.name}</span>
                    {replyFilePreviewUrl ? <audio controls preload="metadata" src={replyFilePreviewUrl} /> : null}
                  </div>
                  <button aria-label="Quitar archivo" onClick={() => setReplyFile(null)} type="button">
                    <X size={15} />
                  </button>
                </div>
              ) : null}
              <div className="composer-line">
                <div className="composer-tabs">
                  <button
                    className="active"
                    aria-label="Conversacion"
                    onClick={() => setActiveConversationTab("chat")}
                    title="Conversacion"
                    type="button"
                  >
                    <MessageSquareText size={18} />
                  </button>
                  <button
                    className="notes-tab"
                    aria-label="Notas internas"
                    onClick={() => setActiveConversationTab("notes")}
                    title="Notas internas"
                    type="button"
                  >
                    <FileText size={18} />
                  </button>
                  <button
                    className="tasks-tab"
                    aria-label="Tareas"
                    onClick={() => setActiveConversationTab("tasks")}
                    title="Tareas"
                    type="button"
                  >
                    <ClipboardList size={18} />
                  </button>
                  <button
                    className="audit-tab"
                    aria-label="Auditoria"
                    onClick={() => setActiveConversationTab("audit")}
                    title="Auditoria"
                    type="button"
                  >
                    <ShieldCheck size={18} />
                  </button>
                </div>
                {recording ? (
                  <button
                    aria-label="Detener grabacion"
                    className="secondary recording-stop composer-icon-button"
                    disabled={sendingReply}
                    onClick={stopRecording}
                    title="Detener"
                    type="button"
                  >
                    <Square size={16} />
                  </button>
                ) : (
                  <button
                    aria-label="Grabar audio"
                    className="secondary composer-icon-button"
                    disabled={sendingReply || preparingRecording}
                    onClick={startRecording}
                    title="Grabar"
                    type="button"
                  >
                    <Mic size={18} />
                  </button>
                )}
                <button
                  aria-label="Adjuntar archivo"
                  className="secondary composer-icon-button"
                  disabled={sendingReply || recording || preparingRecording}
                  onClick={() => attachmentInputRef.current?.click()}
                  title="Adjuntar"
                  type="button"
                >
                  <Paperclip size={18} />
                </button>
                <label className="audio-mode-control" title="Modo de grabacion de audio para este dispositivo">
                  <span>Audio</span>
                  <select
                    disabled={sendingReply || recording || preparingRecording}
                    onChange={(event) => updateAudioRecorderMode(event.target.value as AudioRecorderMode)}
                    value={audioRecorderMode}
                  >
                    <option value="auto">Auto</option>
                    <option value="normal">Normal</option>
                    <option value="compatible">Compatible</option>
                    <option value="very-compatible">Muy compatible</option>
                  </select>
                </label>
                <div className="reply-input-wrap">
                  <textarea
                    disabled={sendingReply}
                    onChange={(event) => setReplyText(event.target.value)}
                    onKeyDown={handleReplyKeyDown}
                    onPaste={(event) => {
                      const items = Array.from(event.clipboardData?.items ?? []);
                      const imageItem = items.find((item) => item.type.startsWith("image/"));
                      if (imageItem) {
                        const file = imageItem.getAsFile();
                        if (file) {
                          event.preventDefault();
                          const named = new File([file], `captura-${Date.now()}.png`, { type: file.type });
                          setAttachment(named);
                        }
                      }
                    }}
                    placeholder={replyFile ? "Mensaje opcional para acompanar el archivo" : "Escribir respuesta"}
                    value={replyText}
                  />
                  {quickReplyQuery !== null ? (
                    <div className="quick-reply-picker">
                      {matchingQuickReplies.length ? matchingQuickReplies.map((reply, index) => (
                        <button
                          className={index === activeQuickReplyIndex ? "active" : ""}
                          key={reply.id}
                          onClick={() => insertQuickReply(reply)}
                          onMouseEnter={() => setActiveQuickReplyIndex(index)}
                          type="button"
                        >
                          <strong>{reply.name}</strong>
                          <span>/{reply.shortcut}</span>
                        </button>
                      )) : (
                        <span>No hay respuestas para /{quickReplyQuery}</span>
                      )}
                    </div>
                  ) : null}
                </div>
                <button className="primary" disabled={sendingReply || preparingRecording || (!replyText.trim() && !replyFile)} type="submit">
                  <SendHorizonal size={18} />
                  {sendingReply ? (replyProgress || "Enviando") : replyFile ? getAttachmentSendLabel(replyFile) : "Enviar"}
                </button>
              </div>
              {replyError ? <span className="warn">{replyError}</span> : null}
              </form>
            ) : (
              <div className="conversation-bottom-bar">
                <div className="composer-tabs">
                  <button
                    className=""
                    onClick={() => setActiveConversationTab("chat")}
                    type="button"
                  >
                    Conversacion
                  </button>
                  <button
                    className={`notes-tab ${activeConversationTab === "notes" ? "active" : ""}`}
                    onClick={() => setActiveConversationTab("notes")}
                    type="button"
                  >
                    Notas internas
                  </button>
                  <button
                    className={`tasks-tab ${activeConversationTab === "tasks" ? "active" : ""}`}
                    onClick={() => setActiveConversationTab("tasks")}
                    type="button"
                  >
                    Tareas
                  </button>
                  <button
                    className={`audit-tab ${activeConversationTab === "audit" ? "active" : ""}`}
                    onClick={() => setActiveConversationTab("audit")}
                    type="button"
                  >
                    Auditoria
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">Selecciona una conversacion.</div>
        )}
      </div>
    </div>
  );
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function getFollowUpStatusLabel(status: ConversationFollowUp["status"]) {
  if (status === "proposed") {
    return "Sugerida";
  }

  if (status === "pending") {
    return "Pendiente";
  }

  if (status === "sent") {
    return "Realizada";
  }

  return "Cancelada";
}

function getConversationEventTitle(event: ConversationEvent) {
  if (event.event === "conversation_assigned") {
    return "Transferencia manual";
  }

  if (event.event === "conversation_unassigned") {
    return "Desasignacion";
  }

  if (event.event === "conversation_status_changed") {
    return "Cambio de estado";
  }

  if (event.event === "conversation_ai_toggled") {
    return "Cambio de IA";
  }

  if (event.event === "conversation_label_changed") {
    return "Cambio de etiqueta";
  }

  if (event.event === "conversation_name_changed") {
    return "Cambio de nombre";
  }

  if (event.event === "label_automation_assigned") {
    return "Asignacion automatica por etiqueta";
  }

  if (event.event === "selector_checkout_abierto") {
    return "Checkout desde selector";
  }

  if (event.event === "selector_whatsapp_click") {
    return "Click a WhatsApp desde selector";
  }

  if (event.event === "manual_selector_febecos") {
    return "Evento manual: Selector Febecos";
  }

  if (event.event === "manual_purchase") {
    return "Evento manual: Purchase";
  }

  if (event.event === "manual_lead") {
    return "Evento manual: Lead";
  }

  return humanizeTemplateName(event.event);
}

function getConversationEventDescription(event: ConversationEvent) {
  const payload = event.payload ?? {};
  const actorName = typeof payload.actorName === "string" ? payload.actorName : "Sistema";

  if (event.event === "conversation_assigned") {
    const assignedName = typeof payload.toAssignedName === "string" ? payload.toAssignedName : "vendedor";
    return `${actorName} transfirio la conversacion a ${assignedName}.`;
  }

  if (event.event === "conversation_unassigned") {
    return `${actorName} dejo la conversacion sin vendedor asignado.`;
  }

  if (event.event === "conversation_status_changed") {
    const fromStatus = typeof payload.fromStatus === "string" ? humanizeTemplateName(payload.fromStatus) : "estado anterior";
    const toStatus = typeof payload.toStatus === "string" ? humanizeTemplateName(payload.toStatus) : "estado nuevo";
    return `${actorName} cambio el estado de ${fromStatus} a ${toStatus}.`;
  }

  if (event.event === "conversation_ai_toggled") {
    const enabled = Boolean(payload.enabled);
    return `${actorName} ${enabled ? "activo" : "desactivo"} la IA de esta conversacion.`;
  }

  if (event.event === "conversation_label_changed") {
    const fromLabel = typeof payload.fromLabel === "string" ? humanizeTemplateName(payload.fromLabel) : "sin etiqueta";
    const toLabel = typeof payload.toLabel === "string" ? humanizeTemplateName(payload.toLabel) : "sin etiqueta";
    return `${actorName} cambio la etiqueta de ${fromLabel} a ${toLabel}.`;
  }

  if (event.event === "conversation_name_changed") {
    const fromName = typeof payload.fromName === "string" && payload.fromName ? payload.fromName : "sin nombre";
    const toName = typeof payload.toName === "string" && payload.toName ? payload.toName : "sin nombre";
    return `${actorName} cambio el nombre de ${fromName} a ${toName}.`;
  }

  if (event.event === "label_automation_assigned") {
    const labelName = typeof payload.labelName === "string" ? payload.labelName : payload.label;
    const assignedName = typeof payload.assignedName === "string" ? payload.assignedName : "vendedor";
    return `FEBO asigno la conversacion a ${assignedName} por la etiqueta ${labelName ?? "configurada"}.`;
  }

  if (event.event === "selector_checkout_abierto") {
    return "El cliente abrio o envio datos desde el selector de Febecos.";
  }

  if (event.event === "selector_whatsapp_click") {
    const click = payload.whatsapp_click as Record<string, unknown> | undefined;
    const zone = typeof click?.zona === "string" && click.zona ? ` Zona: ${click.zona}.` : "";
    return `El cliente toco el boton de WhatsApp del selector, pero todavia puede no haber enviado mensaje.${zone}`;
  }

  if (event.event === "manual_selector_febecos" || event.event === "manual_purchase" || event.event === "manual_lead") {
    const eventName = typeof payload.eventName === "string" ? payload.eventName : humanizeTemplateName(event.event);
    return `${actorName} envio manualmente el evento ${eventName}.`;
  }

  return JSON.stringify(payload);
}

function formatListDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function parseBulkTemplates(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", languageCode = "es_AR", label = "", category = "utility", ...bodyParts] = line.split("|").map((part) => part.trim());
      const safeName = name.trim();

      return {
        label: label || humanizeTemplateName(safeName),
        name: safeName,
        languageCode: languageCode || "es_AR",
        category: category || "utility",
        body: bodyParts.join(" | "),
        active: true
      };
    })
    .filter((template) => template.name.length >= 2);
}

function humanizeTemplateName(name: string) {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function DeliveryStatus({ message }: { message: ConversationMessage }) {
  const failed = message.whatsapp_status === "failed";
  const deliveryError = getFriendlyWhatsAppError(message.whatsapp_error);
  const statusIcon =
    message.whatsapp_status === "read" || message.whatsapp_status === "delivered" ? (
      <CheckCheck size={14} />
    ) : message.whatsapp_status === "sent" ? (
      <Check size={14} />
    ) : failed ? (
      <AlertCircle size={14} />
    ) : (
      <Clock3 size={14} />
    );

  return (
    <span className={`delivery-status ${failed ? "failed" : message.whatsapp_status ?? ""}`} title={deliveryError ?? message.whatsapp_error ?? undefined}>
      {statusIcon}
      {formatDeliveryStatus(message)}
    </span>
  );
}

function getReplyOptions(message: ConversationMessage) {
  return Array.isArray(message.reply_options) ? message.reply_options : [];
}

function formatDeliveryStatus(message: ConversationMessage) {
  if (message.whatsapp_status === "failed") {
    return `Fallo WhatsApp: ${getFriendlyWhatsAppError(message.whatsapp_error)}`;
  }

  const labels: Record<string, string> = {
    accepted: "Aceptado por Meta",
    sent: "Enviado",
    delivered: "Entregado",
    read: "Leido"
  };

  return labels[message.whatsapp_status ?? ""] ?? message.whatsapp_status ?? "";
}

function getFriendlyWhatsAppError(error?: string | null) {
  const normalized = (error ?? "").toLowerCase();

  if (normalized.includes("part of an experiment") || normalized.includes("130472")) {
    return "Meta bloqueo esta plantilla para este numero. Pedile al cliente que escriba primero o intenten luego.";
  }

  if (!error) {
    return "Meta no lo entrego.";
  }

  return error;
}

function MessageMedia({
  message,
  onImageOpen
}: {
  message: ConversationMessage;
  onImageOpen: (preview: { alt: string; src: string }) => void;
}) {
  const src = `/api/message-media?messageId=${message.id}`;
  const mimeType = message.media_mime_type ?? "";
  const filename = message.media_filename ?? "archivo";

  if (mimeType.startsWith("image/")) {
    return (
      <button
        aria-label="Ampliar imagen"
        className="message-image-button"
        onClick={() => onImageOpen({ alt: filename, src })}
        type="button"
      >
        <img alt={filename} className="message-image" src={src} />
      </button>
    );
  }

  if (mimeType.startsWith("audio/")) {
    return <AudioMessageCard filename={filename} message={message} src={src} />;
  }

  if (mimeType.startsWith("video/")) {
    return <video className="message-video" controls preload="metadata" src={src} />;
  }

  return (
    <a className="message-file" href={src} rel="noreferrer" target="_blank">
      <FileText size={17} />
      <span>{filename}</span>
    </a>
  );
}

function AudioMessageCard({
  filename,
  message,
  src
}: {
  filename: string;
  message: ConversationMessage;
  src: string;
}) {
  const transcript = getAudioTranscript(message.body);

  return (
    <div className="message-audio-card">
      <div className="message-audio-icon">
        <Mic size={16} />
      </div>
      <div className="message-audio-content">
        <audio controls preload="metadata" src={src} />
        <strong>AUDIO</strong>
        {transcript ? (
          <details className="message-transcript">
            <summary>Ver transcripcion</summary>
            <p>{transcript}</p>
          </details>
        ) : null}
        <span className="message-audio-name">[Audio: {filename.replace(/\.[^.]+$/, "")}]</span>
      </div>
    </div>
  );
}

function isAudioMessage(message: ConversationMessage) {
  return Boolean(message.media_mime_type?.startsWith("audio/"));
}

function getMessageAuthorLabel(message: ConversationMessage) {
  if (message.direction === "inbound") {
    return "Cliente";
  }

  if (isHumanOutboundMessage(message)) {
    return message.created_by_name ?? "Agente";
  }

  if (message.direction === "internal") {
    return message.created_by_name ?? "Nota interna";
  }

  return "Febo AI";
}

function getQuickReplyQuery(text: string) {
  return text.match(/(^|\s)\/([^\s/]*)$/)?.[2] ?? null;
}

function isHumanOutboundMessage(message: ConversationMessage) {
  return message.direction === "outbound" && message.source !== "febo_ai" && (Boolean(message.created_by) || message.source === "manual");
}

function markLatestManualReply(messages: ConversationMessage[], currentUser: AppUser | null) {
  if (!currentUser?.id) {
    return messages;
  }

  const latestManualIndex = [...messages].reverse().findIndex((message) => message.direction === "outbound");

  if (latestManualIndex < 0) {
    return messages;
  }

  const index = messages.length - 1 - latestManualIndex;

  return messages.map((message, messageIndex) => messageIndex === index ? {
    ...message,
    source: "manual",
    created_by: message.created_by ?? currentUser.id,
    created_by_name: message.created_by_name ?? currentUser.full_name
  } : message);
}

function getArgentinaScheduledIso(value: string) {
  if (!value) {
    return null;
  }

  const scheduledAt = new Date(`${value}:00-03:00`);

  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    return null;
  }

  return scheduledAt.toISOString();
}

function getAudioTranscript(body: string) {
  const prefix = "Audio transcripto:";
  return body.startsWith(prefix) ? body.slice(prefix.length).trim() : "";
}

function isSupportedClientAttachment(file: File) {
  const mimeType = getClientAttachmentMimeType(file);
  const supportedImages = ["image/jpeg", "image/png", "image/webp"];
  const supportedVideos = ["video/mp4", "video/3gpp", "video/3gp"];
  const supportedDocuments = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain"
  ];

  return supportedImages.includes(mimeType) || supportedVideos.includes(mimeType) || isSupportedClientAudio(mimeType) || supportedDocuments.includes(mimeType);
}

function shouldUseBlobUpload(file: File) {
  return !getClientAttachmentMimeType(file).startsWith("audio/") && file.size > DIRECT_ATTACHMENT_UPLOAD_LIMIT_BYTES;
}

function getClientAttachmentMaxBytes(file: File) {
  const mimeType = getClientAttachmentMimeType(file);

  if (mimeType.startsWith("audio/")) {
    return BACKEND_ATTACHMENT_UPLOAD_LIMIT_BYTES;
  }

  if (mimeType.startsWith("video/")) {
    return CLIENT_DIRECT_UPLOAD_LIMIT_BYTES;
  }

  return BACKEND_ATTACHMENT_UPLOAD_LIMIT_BYTES;
}

function formatMegabytes(bytes: number) {
  return Math.floor(bytes / (1024 * 1024));
}

function buildAttachmentFormData(conversationId: string, file: File, caption?: string) {
  const formData = new FormData();
  formData.append("conversationId", conversationId);
  formData.append("file", file);

  if (caption) {
    formData.append("caption", caption);
  }

  return formData;
}

function normalizeClientAttachmentFile(file: File) {
  const mimeType = getClientAttachmentMimeType(file);
  const rawMimeType = file.type.split(";")[0].trim().toLowerCase();

  if (!mimeType || rawMimeType === mimeType) {
    return file;
  }

  return new File([file], file.name || "archivo", { type: mimeType });
}

function getClientAttachmentMimeType(file: File) {
  const mimeType = file.type.split(";")[0].trim().toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "mp4" && (!mimeType || mimeType === "application/octet-stream" || mimeType === "video/quicktime")) {
    return "video/mp4";
  }

  if (extension === "3gp" && (!mimeType || mimeType === "application/octet-stream")) {
    return "video/3gpp";
  }

  if (["m4a", "mp4a"].includes(extension ?? "") && (!mimeType || mimeType === "application/octet-stream")) {
    return "audio/mp4";
  }

  if (extension === "aac" && (!mimeType || mimeType === "application/octet-stream")) {
    return "audio/aac";
  }

  if (extension === "mp3" && (!mimeType || mimeType === "application/octet-stream")) {
    return "audio/mpeg";
  }

  if (extension === "ogg" && (!mimeType || mimeType === "application/octet-stream")) {
    return "audio/ogg";
  }

  if (extension === "wav" && (!mimeType || mimeType === "application/octet-stream")) {
    return "audio/wav";
  }

  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }

  if (extension === "mp4") {
    return "video/mp4";
  }

  if (extension === "3gp") {
    return "video/3gpp";
  }

  if (["m4a", "mp4a"].includes(extension ?? "")) {
    return "audio/mp4";
  }

  if (extension === "aac") {
    return "audio/aac";
  }

  if (extension === "mp3") {
    return "audio/mpeg";
  }

  if (extension === "ogg") {
    return "audio/ogg";
  }

  if (extension === "wav") {
    return "audio/wav";
  }

  return mimeType;
}

function isSupportedClientAudio(mimeType: string) {
  const raw = mimeType.trim().toLowerCase();
  const normalized = raw.split(";")[0].trim();

  if (normalized === "audio/mp4" && raw.includes("opus")) {
    return false;
  }

  return ["audio/aac", "audio/amr", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm"].includes(normalized);
}

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/aac"
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function shouldUsePcmRecorderForDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform?.toLowerCase() ?? "";
  const deviceText = `${userAgent} ${platform}`;

  return /\b(huawei|honor|emui|harmonyos|lya-|kirin)\b/i.test(deviceText);
}

function isAudioRecorderMode(value: unknown): value is AudioRecorderMode {
  return value === "auto" || value === "normal" || value === "compatible" || value === "very-compatible";
}

function getRecordingExtension(mimeType: string) {
  if (mimeType === "audio/ogg") {
    return "ogg";
  }

  if (mimeType === "audio/aac") {
    return "aac";
  }

  return "m4a";
}

function getAttachmentSendLabel(file: File) {
  const mimeType = getClientAttachmentMimeType(file);

  if (mimeType.startsWith("audio/")) {
    return "Enviar audio";
  }

  if (mimeType.startsWith("image/")) {
    return "Enviar imagen";
  }

  if (mimeType.startsWith("video/")) {
    return "Enviar video";
  }

  return "Enviar archivo";
}

function formatRecordingSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function buildWavRecordingFile(chunks: Int16Array[], sampleRate: number) {
  if (!chunks.length) {
    return null;
  }

  const sourceSampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);

  if (!sourceSampleCount) {
    return null;
  }

  const targetSampleRate = Math.min(sampleRate || PCM_RECORDING_TARGET_SAMPLE_RATE, PCM_RECORDING_TARGET_SAMPLE_RATE);
  const outputSamples = resamplePcm16(chunks, sampleRate || targetSampleRate, targetSampleRate);
  const sampleCount = outputSamples.length;
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  let cursor = 0;

  writeAscii(view, cursor, "RIFF");
  cursor += 4;
  view.setUint32(cursor, 36 + sampleCount * 2, true);
  cursor += 4;
  writeAscii(view, cursor, "WAVE");
  cursor += 4;
  writeAscii(view, cursor, "fmt ");
  cursor += 4;
  view.setUint32(cursor, 16, true);
  cursor += 4;
  view.setUint16(cursor, 1, true);
  cursor += 2;
  view.setUint16(cursor, 1, true);
  cursor += 2;
  view.setUint32(cursor, targetSampleRate, true);
  cursor += 4;
  view.setUint32(cursor, targetSampleRate * 2, true);
  cursor += 4;
  view.setUint16(cursor, 2, true);
  cursor += 2;
  view.setUint16(cursor, 16, true);
  cursor += 2;
  writeAscii(view, cursor, "data");
  cursor += 4;
  view.setUint32(cursor, sampleCount * 2, true);
  cursor += 4;

  for (const sample of outputSamples) {
    view.setInt16(cursor, sample, true);
    cursor += 2;
  }

  return new File([buffer], `audio-febo-${Date.now()}.wav`, { type: "audio/wav" });
}

function resamplePcm16(chunks: Int16Array[], sourceSampleRate: number, targetSampleRate: number) {
  const sourceSampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const source = new Int16Array(sourceSampleCount);
  let cursor = 0;

  for (const chunk of chunks) {
    source.set(chunk, cursor);
    cursor += chunk.length;
  }

  if (!source.length || sourceSampleRate <= targetSampleRate) {
    return source;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.floor(source.length / ratio));
  const output = new Int16Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, source.length - 1);
    const fraction = sourceIndex - leftIndex;
    output[index] = Math.round(source[leftIndex] + (source[rightIndex] - source[leftIndex]) * fraction);
  }

  return output;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-cell">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

type LearningItem = {
  id: string;
  topic: string;
  customer_pattern: string;
  how_to_respond: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

function LearningsPanel() {
  const [items, setItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/learnings");
    const payload = await readJsonResponse(response);
    setItems(payload?.learnings ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function setStatus(id: string, status: "approved" | "rejected" | "pending") {
    setBusy(id);
    await fetch("/api/learnings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status })
    });
    setBusy("");
    await load();
  }

  async function runDistill() {
    setBusy("distill");
    setMessage("Analizando respuestas del equipo...");
    const response = await fetch("/api/learnings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "distill", sinceHours: 72 })
    });
    const payload = await readJsonResponse(response);
    setBusy("");
    setMessage(payload?.ok ? `Listo. ${payload.inserted ?? 0} aprendizajes nuevos para revisar.` : (payload?.error ?? "No pudimos analizar."));
    await load();
  }

  const pending = items.filter((i) => i.status === "pending");
  const approved = items.filter((i) => i.status === "approved");
  const rejected = items.filter((i) => i.status === "rejected");

  function card(item: LearningItem) {
    return (
      <article className="learning-card" key={item.id}>
        <strong>{item.topic}</strong>
        <p><em>Cuando:</em> {item.customer_pattern}</p>
        <p><em>Cómo responder:</em> {item.how_to_respond}</p>
        <div className="learning-actions">
          {item.status !== "approved" ? (
            <button className="primary" disabled={busy === item.id} onClick={() => void setStatus(item.id, "approved")} type="button">Aprobar</button>
          ) : null}
          {item.status !== "rejected" ? (
            <button className="secondary" disabled={busy === item.id} onClick={() => void setStatus(item.id, "rejected")} type="button">Rechazar</button>
          ) : null}
          {item.status !== "pending" ? (
            <button className="secondary" disabled={busy === item.id} onClick={() => void setStatus(item.id, "pending")} type="button">Volver a pendiente</button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <div className="tool-panel learnings-panel">
      <div className="learnings-head">
        <div>
          <h2>Aprendizajes de la IA</h2>
          <p>Febo propone aprendizajes leyendo cómo responde el equipo. Vos los aprobás y recién ahí los usa con los clientes.</p>
        </div>
        <button className="primary" disabled={busy === "distill"} onClick={() => void runDistill()} type="button">
          {busy === "distill" ? "Analizando..." : "Analizar respuestas ahora"}
        </button>
      </div>
      {message ? <p className="learnings-msg">{message}</p> : null}
      {loading ? <p>Cargando...</p> : null}

      <h3>Pendientes de revisar ({pending.length})</h3>
      {pending.length ? pending.map(card) : <p className="empty-state">No hay aprendizajes pendientes. Tocá "Analizar respuestas ahora" o esperá la corrida automática diaria.</p>}

      <h3>Aprobados — activos en el bot ({approved.length})</h3>
      {approved.length ? approved.map(card) : <p className="empty-state">Todavía no aprobaste ninguno.</p>}

      {rejected.length ? (<><h3>Rechazados ({rejected.length})</h3>{rejected.map(card)}</>) : null}
    </div>
  );
}

function AgentTester() {
  const [phone, setPhone] = useState("5491123456789");
  const [message, setMessage] = useState("Hola, quiero precio para una bomba solar.");
  const [answer, setAnswer] = useState<AgentTestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setAnswer(null);

    const response = await fetch("/api/agent/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, message })
    });
    const payload = await readJsonResponse(response);
    setLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "No se pudo generar la respuesta.");
      return;
    }

    setAnswer(payload as AgentTestResponse);
  }

  return (
    <aside className="agent-panel">
      <form className="tester" onSubmit={submit}>
        <div className="tester-row">
          <label className="field tester-phone">
            <span>Teléfono</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <button className="tester-send" disabled={loading} type="submit">
            <SendHorizonal size={14} />
            {loading ? "…" : "Enviar"}
          </button>
        </div>
        <label className="field">
          <span>Mensaje</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>

        {error ? <span className="warn">{error}</span> : null}

        {answer && (
          <div className="tester-result">
            <div className="tester-chips">
              <span className="tester-chip">{answer.consultype}</span>
              {answer.escalar && <span className="tester-chip tester-chip--warn">escala</span>}
              {answer.segundoMensaje && <span className="tester-chip tester-chip--info">2 mensajes</span>}
            </div>

            <div className="tester-msg">
              {answer.segundoMensaje && <span className="tester-msg-label">Mensaje 1</span>}
              <p>{answer.respuesta}</p>
            </div>

            {answer.segundoMensaje && (
              <div className="tester-msg tester-msg--2">
                <span className="tester-msg-label">Mensaje 2 · 30 seg después</span>
                <p>{answer.segundoMensaje}</p>
              </div>
            )}
          </div>
        )}

        {!answer && (
          <p className="tester-empty">La respuesta aparece acá.</p>
        )}
      </form>
    </aside>
  );
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.reload();
}

function getStatusLabel(value: string) {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getConsultypeLabel(value: string) {
  return CONSULTYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getContactInfoPayload(payload: Record<string, unknown> | null | undefined) {
  const rawInfo = payload?.contact_info as { notes?: unknown; additional?: unknown } | undefined;
  const rawAdditional = Array.isArray(rawInfo?.additional) ? rawInfo.additional : [];

  return {
    notes: typeof rawInfo?.notes === "string" ? rawInfo.notes : "",
    additional: rawAdditional
      .map((item) => {
        const value = item as { id?: unknown; title?: unknown; value?: unknown };
        return {
          id: typeof value.id === "string" ? value.id : String(Date.now() + Math.random()),
          title: typeof value.title === "string" ? value.title : "",
          value: typeof value.value === "string" ? value.value : ""
        };
      })
      .filter((item) => item.title || item.value)
  };
}

function getFallbackLabelColor(slug: string) {
  const colors: Record<string, string> = {
    caliente: "#f43f5e",
    cliente: "#42c767",
    comparador: "#fbbf24",
    cotizado: "#16a34a",
    "contacto-de-bobbio": "#38bdf8",
    "esperando-respuesta": "#f97316",
    "fuera-de-horario": "#f97316",
    "no-leido": "#f97316",
    "pasar-presupuesto": "#38bdf8",
    "pocero-instalador": "#38bdf8",
    "presupuesto-enviado": "#38bdf8",
    otro: "#94a3b8"
  };

  return colors[slug] ?? "#38bdf8";
}

function hardRefreshApp() {
  const url = new URL(window.location.href);
  url.searchParams.set("refresh", Date.now().toString());
  window.location.replace(url.toString());
}

async function enablePushNotifications(setStatus: (status: string) => void, setNotice?: (message: string) => void) {
  const notify = (message: string) => {
    setStatus(message);
    setNotice?.(`Notificaciones: ${message}`);
  };

  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    notify("No compatible");
    return;
  }

  notify("Activando...");

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      notify("Sin permiso");
      return;
    }

    const keyResponse = await fetch("/api/push/vapid-public-key");
    const keyPayload = await readJsonResponse(keyResponse);

    if (!keyResponse.ok || !keyPayload?.configured || !keyPayload.publicKey) {
      notify("Falta config");
      return;
    }

    const registration = await navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`);
    const subscription =
      await registration.pushManager.getSubscription() ??
      await registration.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
        userVisibleOnly: true
      });

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription)
    });

    notify(response.ok ? "Activas" : "Error push");
  } catch {
    notify("Error push");
  }
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

function getNotificationAudioContext(audioContextRef: { current: AudioContext | null }) {
  if (audioContextRef.current) {
    return audioContextRef.current;
  }

  const AudioContextConstructor =
    window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  audioContextRef.current = new AudioContextConstructor();
  return audioContextRef.current;
}

async function unlockInboxNotificationSound(audioContextRef: { current: AudioContext | null }) {
  const context = getNotificationAudioContext(audioContextRef);

  if (!context) {
    return false;
  }

  if (context.state === "suspended") {
    await context.resume().catch(() => undefined);
  }

  if (context.state !== "running") {
    return false;
  }

  const now = context.currentTime;
  const gain = context.createGain();
  const oscillator = context.createOscillator();
  gain.gain.setValueAtTime(0.00001, now);
  oscillator.frequency.setValueAtTime(1, now);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.02);

  return true;
}

async function playInboxNotificationSound(
  audioContextRef: { current: AudioContext | null },
  config: NotificationSoundConfig = DEFAULT_NOTIFICATION_SOUND_CONFIG
) {
  const normalizedConfig = normalizeNotificationSoundConfig(config);

  if (normalizedConfig.sound === "none" || normalizedConfig.volume <= 0) {
    return;
  }

  const unlocked = await unlockInboxNotificationSound(audioContextRef);

  if (!unlocked) {
    return;
  }

  const context = audioContextRef.current;
  if (!context) {
    return;
  }
  const now = context.currentTime;
  const gain = context.createGain();
  const targetGain = Math.max(0.0001, Math.min(0.28, normalizedConfig.volume * 0.28));
  const pattern = getNotificationSoundPattern(normalizedConfig.sound);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(targetGain, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + pattern.duration);
  gain.connect(context.destination);

  for (const tone of pattern.tones) {
    const oscillator = context.createOscillator();
    const startAt = now + tone.offset;
    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.frequency, startAt);
    oscillator.connect(gain);
    oscillator.start(startAt);
    oscillator.stop(startAt + tone.length);
  }
}

function getNotificationSoundPattern(sound: NotificationSoundName) {
  switch (sound) {
    case "ping":
      return {
        duration: 0.24,
        tones: [{ frequency: 980, length: 0.16, offset: 0, type: "triangle" as OscillatorType }]
      };
    case "soft":
      return {
        duration: 0.44,
        tones: [
          { frequency: 523, length: 0.18, offset: 0, type: "sine" as OscillatorType },
          { frequency: 659, length: 0.2, offset: 0.16, type: "sine" as OscillatorType }
        ]
      };
    case "alert":
      return {
        duration: 0.42,
        tones: [
          { frequency: 740, length: 0.12, offset: 0, type: "square" as OscillatorType },
          { frequency: 988, length: 0.12, offset: 0.15, type: "square" as OscillatorType }
        ]
      };
    case "none":
      return { duration: 0, tones: [] };
    case "chime":
    default:
      return {
        duration: 0.36,
        tones: [
          { frequency: 880, length: 0.12, offset: 0, type: "sine" as OscillatorType },
          { frequency: 1175, length: 0.12, offset: 0.14, type: "sine" as OscillatorType }
        ]
      };
  }
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text.trim() };
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = MANUAL_REPLY_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("El envio tardo demasiado y se corto. Proba con un audio mas corto o reenviarlo.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function getReplySendError(response: Response, payload: { error?: string } | null) {
  if (response.status === 413) {
    return "El archivo es demasiado grande para subirlo directo desde FEBO. Para videos grandes vamos a usar link/YouTube o almacenamiento externo.";
  }

  if (payload?.error) {
    return payload.error.length > 240 ? `${payload.error.slice(0, 240)}...` : payload.error;
  }

  return `No pudimos enviar el mensaje (${response.status}).`;
}

// ══════════════════════════════════════════════════════════════════
// Panel: Transportistas por zona
// Permite buscar qué transportista cubre una provincia / localidad.
// Útil mientras se atiende una consulta de envío por WhatsApp.
// ══════════════════════════════════════════════════════════════════

const PROVINCIAS_AR = [
  "Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes",
  "Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones",
  "Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe",
  "Santiago del Estero","Tierra del Fuego","Tucumán",
];

const CONFIDENCE_LABEL: Record<string, string> = {
  alta: "✅ Alta confianza",
  media: "🟡 Media",
  baja: "🔴 Baja",
  manual: "✏️ Manual",
};

function TransportistasPanel() {
  const [provincia, setProvincia] = useState("");
  const [localidadInput, setLocalidadInput] = useState("");
  const [localidadSel, setLocalidadSel] = useState<LocalidadRow | null>(null);
  const [localidadOpts, setLocalidadOpts] = useState<LocalidadRow[]>([]);
  const [dropOpen, setDropOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TransportistaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autocomplete de localidades
  useEffect(() => {
    if (!localidadInput || localidadInput.length < 2) {
      setLocalidadOpts([]);
      setDropOpen(false);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const locs = await fetchLocalidades(localidadInput, provincia || undefined);
        setLocalidadOpts(locs.slice(0, 8));
        setDropOpen(locs.length > 0);
      } catch { /* silenciar en autocomplete */ }
    }, 280);
  }, [localidadInput, provincia]);

  const buscar = useCallback(async () => {
    if (!provincia) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const loc = localidadSel?.name || undefined;
      const rows = await fetchTransportistas(provincia, loc);
      setResults(rows);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [provincia, localidadSel]);

  function pickLocalidad(loc: LocalidadRow) {
    setLocalidadSel(loc);
    setLocalidadInput(loc.name);
    setDropOpen(false);
  }

  function clearLocalidad() {
    setLocalidadSel(null);
    setLocalidadInput("");
    setLocalidadOpts([]);
    setDropOpen(false);
  }

  function getContactoPrincipal(t: TransportistaRow) {
    const wa  = t.contactos.find(c => c.type === "whatsapp");
    const tel = t.contactos.find(c => c.type === "phone");
    return wa || tel || t.contactos[0] || null;
  }

  const topConfidence = (zonas: TransportistaRow["zonas_detalle"]) => {
    const order = ["alta","media","baja","manual"];
    const found = order.find(c => zonas.some(z => z.confidence === c));
    return found ?? "manual";
  };

  return (
    <section className="admin-panel" style={{ maxWidth: 680 }}>
      <div className="panel-title">
        <h2>🚚 Transportistas por zona</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          Consultá qué transportista cubre una provincia o localidad para informarle al cliente.
        </p>
      </div>

      {/* Formulario de búsqueda */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 20 }}>
        <label className="field" style={{ flex: "1 1 180px", minWidth: 160 }}>
          Provincia *
          <select
            value={provincia}
            onChange={e => { setProvincia(e.target.value); setResults(null); }}
          >
            <option value="">— Seleccioná —</option>
            {PROVINCIAS_AR.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>

        <label className="field" style={{ flex: "2 1 220px", minWidth: 180, position: "relative" }}>
          Localidad (opcional)
          <div style={{ position: "relative" }}>
            <input
              placeholder="Ej: Bahía Blanca, Colón…"
              value={localidadInput}
              disabled={!provincia}
              onChange={e => { setLocalidadInput(e.target.value); setLocalidadSel(null); }}
              onBlur={() => setTimeout(() => setDropOpen(false), 180)}
              onFocus={() => localidadOpts.length > 0 && setDropOpen(true)}
              style={{ paddingRight: localidadSel ? 28 : undefined }}
            />
            {localidadSel && (
              <button
                type="button"
                onClick={clearLocalidad}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--muted)", lineHeight: 1 }}
                title="Limpiar localidad"
              >×</button>
            )}
            {dropOpen && localidadOpts.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,.1)", zIndex: 200, maxHeight: 200, overflowY: "auto" }}>
                {localidadOpts.map(loc => (
                  <button
                    key={loc.id}
                    type="button"
                    onMouseDown={() => pickLocalidad(loc)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontSize: 13 }}
                  >
                    <strong>{loc.name}</strong>
                    <span style={{ marginLeft: 6, fontSize: 11, color: "#94a3b8" }}>{loc.province}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <button
          className="primary"
          type="button"
          disabled={!provincia || loading}
          onClick={buscar}
          style={{ alignSelf: "flex-end", minWidth: 100, height: 38 }}
        >
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#fff0f4", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Sin resultados */}
      {results !== null && results.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", fontSize: 14 }}>
          Sin transportistas registrados para esa zona.
          <br />
          <span style={{ fontSize: 12 }}>Intentá buscar solo por provincia.</span>
        </div>
      )}

      {/* Resultados */}
      {results && results.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
            {results.length} transportista{results.length !== 1 ? "s" : ""} encontrado{results.length !== 1 ? "s" : ""}
            {localidadSel ? ` para ${localidadSel.name}, ${provincia}` : ` en ${provincia}`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {results.map(t => {
              const ct = getContactoPrincipal(t);
              const conf = topConfidence(t.zonas_detalle);
              const zonaLabel = t.zonas_detalle.some(z => !z.locality || z.coverage_type === "province_wide")
                ? `${provincia} (provincia entera)`
                : t.zonas_detalle.filter(z => z.locality).map(z => z.locality).join(", ");

              return (
                <div key={t.id} style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <strong style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.3 }}>{t.nombre}</strong>
                    <span style={{ fontSize: 11, whiteSpace: "nowrap", color: conf === "alta" ? "#166534" : conf === "media" ? "#92400e" : "#9ca3af", background: conf === "alta" ? "#dcfce7" : conf === "media" ? "#fef9c3" : "#f1f5f9", borderRadius: 5, padding: "2px 7px", fontWeight: 600 }}>
                      {CONFIDENCE_LABEL[conf] ?? conf}
                    </span>
                  </div>

                  {/* Contacto principal */}
                  {ct && (
                    <div style={{ fontSize: 13, marginBottom: 5 }}>
                      {ct.type === "whatsapp" ? (
                        <a href={`https://wa.me/${ct.value.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ color: "#16a34a", fontWeight: 600 }}>
                          📱 {ct.value}
                        </a>
                      ) : ct.type === "phone" ? (
                        <a href={`tel:${ct.value}`} style={{ color: "#1e40af" }}>☎ {ct.value}</a>
                      ) : ct.type === "email" ? (
                        <a href={`mailto:${ct.value}`} style={{ color: "#1e40af" }}>✉ {ct.value}</a>
                      ) : (
                        <span>{ct.value}</span>
                      )}
                    </div>
                  )}

                  {/* Todos los contactos (si hay más) */}
                  {t.contactos.length > 1 && (
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 5, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {t.contactos.filter((c, i) => i > 0 || c !== ct).slice(0, 4).map((c, i) => (
                        <span key={i}>
                          {c.type === "whatsapp" ? "📱" : c.type === "phone" ? "☎" : c.type === "email" ? "✉" : c.type === "web" ? "🌐" : "•"} {c.value}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Zona */}
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    📍 {zonaLabel || provincia}
                    {t.zonas_detalle[0]?.historical_uses ? ` · ${t.zonas_detalle[0].historical_uses} usos en Táctica` : ""}
                  </div>

                  {/* Notas */}
                  {t.notas && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#78350f", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px" }}>
                      {t.notas}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
