"use client";

import { upload } from "@vercel/blob/client";
import {
  AlertCircle,
  BarChart3,
  Bot,
  Check,
  CheckCheck,
  ChevronLeft,
  CircleUserRound,
  Clock3,
  Calendar,
  Edit3,
  FileText,
  Filter,
  ImageIcon,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Mic,
  MoreVertical,
  Paperclip,
  Radio,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  SendHorizonal,
  Square,
  Star,
  Tag,
  Trash2,
  UserCheck,
  UserPlus,
  Zap,
  UsersRound,
  X
} from "lucide-react";
import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  AppUser,
  ContactSummary,
  ConversationMessage,
  ConversationNote,
  ConversationSummary,
  MessageTemplate,
  UserAdminSummary
} from "@/lib/crm";

type Stats = {
  conversations: number;
  contacts: number;
  handoffs: number;
  hot: number;
};

type AgentTestResponse = {
  respuesta: string;
  consultype: string;
  escalar: boolean;
};

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
const DIRECT_ATTACHMENT_UPLOAD_LIMIT_BYTES = 3.8 * 1024 * 1024;

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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <strong>{value.toLocaleString("es-AR")}</strong>
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
  const [activeTool, setActiveTool] = useState<"conversations" | "metrics" | "contacts" | "crm" | "templates" | "users" | "ai">("conversations");
  const [workspaceConversations, setWorkspaceConversations] = useState(conversations);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [conversationNavSignal, setConversationNavSignal] = useState(0);
  const [focusedConversation, setFocusedConversation] = useState({ id: "", signal: 0 });
  const [focusedContact, setFocusedContact] = useState({ id: "", signal: 0 });

  return (
    <section className="admin-workspace">
      <nav className="tool-sidebar" aria-label="Herramientas de trabajo">
        <div className="tool-brand">
          <span className="brand-mark">F</span>
          <strong>Febo AI</strong>
        </div>
        <button
          className={activeTool === "conversations" ? "active" : ""}
          onClick={() => {
            setActiveTool("conversations");
            setConversationNavSignal((current) => current + 1);
          }}
          type="button"
        >
          <Inbox size={18} />
          Conversaciones
        </button>
        <button
          className={activeTool === "metrics" ? "active" : ""}
          onClick={() => setActiveTool("metrics")}
          type="button"
        >
          <BarChart3 size={18} />
          M&eacute;tricas
        </button>
        <button
          className={activeTool === "contacts" ? "active" : ""}
          onClick={() => setActiveTool("contacts")}
          type="button"
        >
          <UsersRound size={18} />
          Contactos
        </button>
        <button
          className={activeTool === "crm" ? "active" : ""}
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
          ULIS
        </button>
        {currentUser.role === "admin" ? (
          <>
            <button className={activeTool === "users" ? "active" : ""} onClick={() => setActiveTool("users")} type="button">
              <ShieldCheck size={18} />
              Usuarios y accesos
            </button>
            <button className={activeTool === "ai" ? "active" : ""} onClick={() => setActiveTool("ai")} type="button">
              <Bot size={18} />
              Probar IA
            </button>
          </>
        ) : null}
        <div className="sidebar-cycle-card">
          <strong>Conversaciones</strong>
          <span>Ciclo actual</span>
          <b>{stats.conversations.toLocaleString("es-AR")}</b>
          <small>20 abr - 20 may</small>
        </div>
        <div className="tool-sidebar-bottom">
          <button onClick={() => window.location.reload()} title="Actualizar" type="button">
            <RefreshCcw size={18} />
            Actualizar
          </button>
          <button onClick={logout} title="Salir" type="button">
            <LogOut size={18} />
            Salir
          </button>
        </div>
      </nav>

      <div className="tool-content">
        {activeTool === "conversations" ? (
          <InboxList
            conversations={workspaceConversations}
            currentUser={currentUser}
            favoriteIds={favoriteIds}
            onConversationsChange={setWorkspaceConversations}
            focusedConversation={focusedConversation}
            resetMobileDetailSignal={conversationNavSignal}
            onToggleFavorite={(conversationId) =>
              setFavoriteIds((current) =>
                current.includes(conversationId) ? current.filter((id) => id !== conversationId) : [...current, conversationId]
              )
            }
            users={users}
          />
        ) : null}
        {activeTool === "metrics" ? <MetricsPanel stats={stats} /> : null}
        {activeTool === "templates" ? <TemplatesPanel /> : null}
        {activeTool === "contacts" ? <ContactsPanel focusedContact={focusedContact} users={users} /> : null}
        {activeTool === "crm" ? (
          <CrmBoardPanel
            conversations={workspaceConversations}
            favoriteIds={favoriteIds}
            onConversationsChange={setWorkspaceConversations}
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
        {activeTool === "users" && currentUser.role === "admin" ? (
          <AdminUsersPanel currentUser={currentUser} initialUsers={adminUsers} />
        ) : null}
        {activeTool === "ai" && currentUser.role === "admin" ? <AgentTester /> : null}
      </div>
    </section>
  );
}

function MetricsPanel({ stats }: { stats: Stats }) {
  return (
    <section className="metrics-panel">
      <div className="metrics-head">
        <h2>M&eacute;tricas</h2>
        <p>Resumen operativo de Febo AI</p>
      </div>
      <div className="metrics-grid">
        <Metric label="Contactos" value={stats.contacts} />
        <Metric label="Conversaciones" value={stats.conversations} />
        <Metric label="Escaladas" value={stats.handoffs} />
        <Metric label="Calientes" value={stats.hot} />
      </div>
    </section>
  );
}

const CRM_BOARD_COLUMNS = [
  { id: "destacados", title: "Destacados", status: null },
  { id: "nuevo", title: "NUEVO", status: "open" },
  { id: "contacto", title: "EN CONTACTO", status: "handoff" },
  { id: "cotizado", title: "COTIZADO", status: "quoted" },
  { id: "cerrado", title: "CERRADO", status: "closed" },
  { id: "no-avanza", title: "NO AVANZA", status: "lost" }
] as const;

function CrmBoardPanel({
  conversations,
  favoriteIds,
  onConversationsChange,
  onOpenChat,
  onOpenContact
}: {
  conversations: ConversationSummary[];
  favoriteIds: string[];
  onConversationsChange: (conversations: ConversationSummary[]) => void;
  onOpenChat: (conversationId: string) => void;
  onOpenContact: (contactId: string) => void;
}) {
  const [draggingId, setDraggingId] = useState("");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCards = conversations.filter((conversation) => {
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

    const previous = conversations;
    const next = conversations.map((conversation) =>
      conversation.id === conversationId ? { ...conversation, status: column.status } : conversation
    );
    onConversationsChange(next);

    const response = await fetch("/api/conversations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId, status: column.status })
    });

    if (!response.ok) {
      onConversationsChange(previous);
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
                  draggable={column.id !== "destacados"}
                  key={`${column.id}-${conversation.id}`}
                  onDragEnd={() => setDraggingId("")}
                  onDragStart={(event) => {
                    setDraggingId(conversation.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", conversation.id);
                  }}
                >
                  <strong>{conversation.display_name || conversation.phone}</strong>
                  <span>{getCrmCardStatusLabel(conversation)}</span>
                  <p>{conversation.last_message || "Sin descripcion comercial"}</p>
                  <div>
                    <button onClick={() => onOpenChat(conversation.id)} type="button">Chat</button>
                    <button onClick={() => onOpenContact(conversation.contact_id)} type="button">Editar</button>
                    <select
                      aria-label="Mover card"
                      onChange={(event) => {
                        void moveConversationToColumn(conversation.id, event.target.value);
                        event.currentTarget.value = "";
                      }}
                      value=""
                    >
                      <option value="" disabled>Mover a</option>
                      {CRM_BOARD_COLUMNS.filter((item) => item.status).map((item) => (
                        <option key={item.id} value={item.id}>{item.title}</option>
                      ))}
                    </select>
                  </div>
                  {favoriteIds.includes(conversation.id) ? <Star size={15} /> : null}
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
  if (columnId === "destacados") {
    return conversations.filter((conversation) => favoriteIds.includes(conversation.id));
  }

  if (columnId === "nuevo") {
    return conversations.filter((conversation) =>
      !conversation.assigned_to &&
      (conversation.status === "open" ||
        conversation.status === "hot" ||
        conversation.consultype === "caliente")
    );
  }

  if (columnId === "contacto") {
    return conversations.filter(
      (conversation) =>
        conversation.status === "handoff" ||
        (Boolean(conversation.assigned_to) && !["quoted", "closed", "lost"].includes(conversation.status))
    );
  }

  const column = CRM_BOARD_COLUMNS.find((item) => item.id === columnId);
  return conversations.filter((conversation) => conversation.status === column?.status);
}

function getCrmCardStatusLabel(conversation: ConversationSummary) {
  if (conversation.consultype === "caliente" || conversation.status === "hot") {
    return "Caliente";
  }

  return "WhatsApp";
}

function ContactsPanel({
  focusedContact,
  users
}: {
  focusedContact: { id: string; signal: number };
  users: AppUser[];
}) {
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selected = useMemo(() => contacts.find((contact) => contact.id === selectedId) ?? contacts[0], [contacts, selectedId]);
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

    setContacts(payload?.contacts ?? []);
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

function TemplatesPanel() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [form, setForm] = useState({
    label: "",
    name: "",
    languageCode: "es_AR",
    category: "utility",
    body: "",
    active: true
  });
  const [bulkTemplates, setBulkTemplates] = useState("");
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [importingTemplates, setImportingTemplates] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function loadTemplates() {
    const response = await fetch("/api/templates");
    const payload = await readJsonResponse(response);

    if (response.ok) {
      setTemplates(payload?.templates ?? []);
    }
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  return (
    <section className="admin-panel">
      <div className="panel-title">
        <MessageSquareText size={18} />
        Plantillas de WhatsApp
        <span>{templates.length}</span>
      </div>
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
      <div className="template-list">
        {templates.map((template) => (
          <div className="template-row" key={template.id}>
            <strong>{template.label}</strong>
            <span>{template.name} - {template.language_code}</span>
            <small>{template.active ? "activa" : "inactiva"} - {template.body || "Sin texto local"}</small>
          </div>
        ))}
      </div>
      {message ? <span className={message.includes("No ") ? "warn" : "ok"}>{message}</span> : null}
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
  onConversationsChange,
  resetMobileDetailSignal,
  onToggleFavorite,
  users
}: {
  conversations: ConversationSummary[];
  currentUser: AppUser;
  favoriteIds: string[];
  focusedConversation: { id: string; signal: number };
  onConversationsChange: (conversations: ConversationSummary[]) => void;
  resetMobileDetailSignal: number;
  onToggleFavorite: (conversationId: string) => void;
  users: AppUser[];
}) {
  const [items, setItems] = useState(conversations);
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? "");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [activeConversationTab, setActiveConversationTab] = useState<"chat" | "notes">("chat");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replyFilePreviewUrl, setReplyFilePreviewUrl] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [draggingFile, setDraggingFile] = useState(false);
  const [recording, setRecording] = useState(false);
  const [preparingRecording, setPreparingRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateComposerOpen, setTemplateComposerOpen] = useState(false);
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedClassifications, setSelectedClassifications] = useState<string[]>([]);
  const [transferUserId, setTransferUserId] = useState("");
  const [chatName, setChatName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateParameters, setTemplateParameters] = useState("");
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordingSamplesRef = useRef<Int16Array[]>([]);
  const recordingSampleRateRef = useRef(44100);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const messageThreadRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef(selectedId);
  const selectedTagsRef = useRef<string[]>([]);
  const selectedClassificationsRef = useRef<string[]>([]);
  const [filters, setFilters] = useState({
    query: "",
    consultype: "all",
    status: "all",
    assignedTo: "all"
  });
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0], [items, selectedId]);
  const activeFiltersCount = selectedTags.length + selectedClassifications.length;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    setMobileDetailOpen(false);
  }, [resetMobileDetailSignal]);

  useEffect(() => {
    if (!focusedConversation.id) {
      return;
    }

    setSelectedId(focusedConversation.id);
    setMobileDetailOpen(true);
  }, [focusedConversation.id, focusedConversation.signal]);

  useEffect(() => {
    return () => {
      stopRecorderTracks();
      clearRecordingTimer();
    };
  }, []);

  useEffect(() => {
    const scrollToBottom = () => {
      if (messageThreadRef.current) {
        messageThreadRef.current.scrollTop = messageThreadRef.current.scrollHeight;
      }
    };

    window.requestAnimationFrame(() => {
      scrollToBottom();
      window.requestAnimationFrame(scrollToBottom);
    });

    const timeoutId = window.setTimeout(scrollToBottom, 120);
    return () => window.clearTimeout(timeoutId);
  }, [activeConversationTab, messages.length, selected?.id]);

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
    setChatName(selected?.display_name || "");
    setTagPanelOpen(false);
    setSummaryOpen(false);
    setQuickRepliesOpen(false);
    setEventMenuOpen(false);
    setTransferOpen(false);
    setTransferUserId(selected?.assigned_to ?? users[0]?.id ?? "");
    setTemplateComposerOpen(false);
    void loadConversationMessages(selected?.id);
    void loadConversationNotes(selected?.id);
  }, [selected?.id]);

  useEffect(() => {
    void loadTemplatesForContactForm();
  }, []);

  useEffect(() => {
    async function refreshVisibleInbox() {
      if (document.hidden || sendingReply || recording) {
        return;
      }

      await refreshConversations(filters, { silent: true });
      await loadConversationMessages(selectedIdRef.current, { silent: true });
      await loadConversationNotes(selectedIdRef.current, { silent: true });
    }

    const intervalId = window.setInterval(() => {
      void refreshVisibleInbox();
    }, 5000);

    window.addEventListener("focus", refreshVisibleInbox);
    document.addEventListener("visibilitychange", refreshVisibleInbox);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshVisibleInbox);
      document.removeEventListener("visibilitychange", refreshVisibleInbox);
    };
  }, [filters, recording, sendingReply]);

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

  async function refreshConversations(nextFilters = filters, options: { silent?: boolean } = {}) {
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
      return tagMatches && sentimentMatches;
    });
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
      setSelectedTemplateId((current) => current || activeTemplates[0]?.id || "");
    }
  }

  async function sendTemplateToSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected?.phone || !selectedTemplateId) {
      setTemplateMessage("Elegi una plantilla para enviar.");
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
          .filter(Boolean)
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
    setTemplateMessage("Plantilla enviada.");
    await refreshConversations(filters, { silent: true });
  }

  function updateFilters(next: Partial<typeof filters>) {
    const nextFilters = { ...filters, ...next };
    setFilters(nextFilters);
    void refreshConversations(nextFilters);
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
      const nextTags = current.length === TAG_FILTERS.length ? [] : [...TAG_FILTERS];
      selectedTagsRef.current = nextTags;
      const nextFilters = { ...filters, consultype: nextTags.length === 1 ? nextTags[0] : "all" };
      setFilters(nextFilters);
      window.setTimeout(() => void refreshConversations(nextFilters), 0);
      return nextTags;
    });
  }

  async function patchConversation(conversationId: string, body: Record<string, unknown>) {
    const response = await fetch("/api/conversations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId, ...body })
    });

    if (!response.ok) {
      return;
    }

    await refreshConversations();
    if (conversationId === selected?.id) {
      await loadConversationMessages(conversationId);
      await loadConversationNotes(conversationId, { silent: true });
    }
  }

  async function saveChatName() {
    if (!selected?.id) {
      return;
    }

    await patchConversation(selected.id, { displayName: chatName.trim() || null });
  }

  function resetFilters() {
    const nextFilters = { query: "", consultype: "all", status: "all", assignedTo: "all" };
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

  async function sendManualReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected?.id || (!replyText.trim() && !replyFile)) {
      return;
    }

    setSendingReply(true);
    setReplyError("");
    let response: Response;

    try {
      if (replyFile && shouldUseBlobUpload(replyFile)) {
        const uploadFile = normalizeClientAttachmentFile(replyFile);
        const blob = await upload(uploadFile.name || "archivo", uploadFile, {
          access: "public",
          handleUploadUrl: "/api/blob/upload"
        });

        response = await fetch("/api/conversation-messages", {
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
      } else {
        const body =
          replyFile ?
            (() => {
              const formData = new FormData();
              formData.append("conversationId", selected.id);
              formData.append("file", replyFile);
              if (replyText.trim()) {
                formData.append("caption", replyText.trim());
              }
              return formData;
            })()
          : JSON.stringify({ conversationId: selected.id, text: replyText.trim() });

        response = await fetch("/api/conversation-messages", {
          method: "POST",
          headers: replyFile ? undefined : { "content-type": "application/json" },
          body
        });
      }
    } catch (error) {
      setSendingReply(false);
      setReplyError(error instanceof Error ? error.message : "No pudimos subir el archivo.");
      return;
    }

    const payload = await readJsonResponse(response);

    setSendingReply(false);

    if (!response.ok) {
      setReplyError(getReplySendError(response, payload));
      return;
    }

    setReplyText("");
    setReplyFile(null);
    setMessages(payload?.messages ?? []);
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

    if (file.size > 16 * 1024 * 1024) {
      setReplyError("El archivo supera 16 MB.");
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

  async function startRecording() {
    setReplyError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setReplyError("Este navegador no permite grabar audio directo. Proba con Adjuntar.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const AudioContextConstructor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextConstructor) {
        setReplyError("Este navegador no permite preparar audio directo. Proba con Adjuntar.");
        stopRecorderTracks();
        return;
      }

      const audioContext = new AudioContextConstructor();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

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

  function clearRecordingTimer() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  return (
    <div className={`inbox-panel ${mobileDetailOpen ? "show-detail" : "show-list"}`}>
      <div className="conversation-list">
        <div className="panel-title">
          Conversaciones
        </div>
        <div className="list-tabs">
          <button className={filters.status === "all" ? "active" : ""} onClick={() => updateFilters({ status: "all" })} type="button">
            Todos
          </button>
          <button className={filters.status === "handoff" ? "active" : ""} onClick={() => updateFilters({ status: "handoff" })} type="button">
            Escalados
          </button>
          <button className={filtersOpen ? "open" : ""} onClick={() => setFiltersOpen(!filtersOpen)} type="button">
            <Filter size={16} />
            Filtros
            {activeFiltersCount ? <span>{activeFiltersCount}</span> : null}
          </button>
        </div>
        <div className="list-quick-actions">
          <label className="search-field">
            <Search size={16} />
            <input
              placeholder="Buscar"
              value={filters.query}
              onChange={(event) => updateFilters({ query: event.target.value })}
            />
          </label>
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
              <span>ETIQUETAS</span>
              <label className={selectedTags.length === TAG_FILTERS.length ? "selected" : ""}>
                <input
                  checked={selectedTags.length === TAG_FILTERS.length}
                  onChange={toggleAllTags}
                  type="checkbox"
                />
                Todas
              </label>
              {TAG_FILTERS.map((tagName) => (
                <label className={selectedTags.includes(tagName) ? "selected" : ""} key={tagName}>
                  <input
                    checked={selectedTags.includes(tagName)}
                    onChange={() => toggleSelectedTag(tagName)}
                    type="checkbox"
                  />
                  {humanizeTemplateName(tagName)}
                </label>
              ))}
            </div>
          </div>
        ) : null}
        {items.length ? (
          items.map((conversation) => (
            <article className={`conversation-row ${conversation.id === selected?.id ? "active" : ""}`} key={conversation.id}>
              <button
                className="conversation-row-main"
                onClick={() => {
                  setSelectedId(conversation.id);
                  setMobileDetailOpen(true);
                }}
                type="button"
              >
                <span className="row-meta">
                  <span className="channel-pill">WHATSAPP</span>
                  <time>{formatListDate(conversation.last_message_at)}</time>
                </span>
                <strong>{conversation.display_name || conversation.phone}</strong>
                <small>Sentimiento: {conversation.sentiment || "neutro"}</small>
                <span className={`tag ${conversation.consultype}`}>{getConsultypeLabel(conversation.consultype)}</span>
                {conversation.assigned_name ? <span className="assigned-pill">asignado: {conversation.assigned_name}</span> : null}
              </button>
              <details className="row-menu">
                <summary aria-label="Acciones"><MoreVertical size={18} /></summary>
                <button onClick={() => patchConversation(conversation.id, { status: "open" })} type="button">Desescalar</button>
                <button type="button">Marcar como no leido</button>
                <button onClick={() => patchConversation(conversation.id, { consultype: "otro" })} type="button">Cambiar tipo</button>
                <button type="button">Bloquear</button>
                <button className="danger" type="button">Eliminar chat</button>
              </details>
            </article>
          ))
        ) : (
          <div className="empty-state">Cuando importemos Hariaz o entren mensajes, van a aparecer aca.</div>
        )}
      </div>

      <div
        className={`conversation-detail ${draggingFile ? "dragging-file" : ""}`}
        onDragLeave={handleConversationDragLeave}
        onDragOver={handleConversationDragOver}
        onDrop={handleDrop}
      >
        {selected ? (
          <>
            <button className="back-button" onClick={() => setMobileDetailOpen(false)} type="button">
              <ChevronLeft size={18} />
              Volver
            </button>
            <div className="detail-head">
              <div className="detail-channel">
                <strong>WHATSAPP</strong>
                <span>| {selected.phone}</span>
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
                  <button onClick={() => patchConversation(selected.id, { status: "open" })} type="button">Desescalar</button>
                  <button type="button">Marcar como no leido</button>
                  <button onClick={() => patchConversation(selected.id, { consultype: "otro" })} type="button">Cambiar tipo</button>
                  <button type="button">Bloquear</button>
                  <button className="danger" type="button"><Trash2 size={14} /> Eliminar chat</button>
                </details>
              </div>
            </div>
            <div className="mobile-detail-name">{selected.display_name || selected.phone}</div>

            <div className="toolbar">
              <label className="chat-name-field">
                Nombre chat:
                <input value={chatName} onChange={(event) => setChatName(event.target.value)} />
              </label>
              <button className="secondary" onClick={saveChatName} type="button">Guardar</button>
              <div className="toolbar-icons">
                <button className="icon-action" onClick={() => setTagPanelOpen(!tagPanelOpen)} title="Editar etiqueta" type="button"><Tag size={17} /></button>
                <button className="icon-action" onClick={() => setSummaryOpen(true)} title="Generar resumen" type="button"><Edit3 size={17} /></button>
                <button className="icon-action active" onClick={() => setTemplateComposerOpen(true)} title="Enviar plantilla" type="button"><Radio size={17} /></button>
                <button className="icon-action" onClick={() => setQuickRepliesOpen(true)} title="Respuestas rapidas" type="button"><Zap size={17} /></button>
                <details className="event-menu" open={eventMenuOpen}>
                  <summary onClick={(event) => { event.preventDefault(); setEventMenuOpen(!eventMenuOpen); }}>
                    <Calendar size={17} />
                    Enviar evento
                    <span>2</span>
                  </summary>
                  <div>
                    <strong>ENVIAR EVENTO</strong>
                    <button type="button"><Calendar size={17} /> <span>Compra<small>Purchase</small></span><b>Enviar</b></button>
                    <button type="button"><Calendar size={17} /> <span>Lead</span><b>Enviar</b></button>
                  </div>
                </details>
              </div>
            </div>

            {tagPanelOpen ? (
              <div className="tag-editor-panel">
                <input placeholder="Buscar o crear etiqueta..." />
                {TAG_FILTERS.slice(0, 8).map((tagName) => (
                  <div className="tag-editor-row" key={tagName}>
                    <span className={`tag-dot ${tagName}`} />
                    <strong>{humanizeTemplateName(tagName)}</strong>
                    <button onClick={() => patchConversation(selected.id, { consultype: tagName })} type="button">Agregar</button>
                    <button className="icon-action danger" type="button"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
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
                    <label className="field">Nombre<input placeholder="Saludo Inicial" /></label>
                    <label className="field">Atajo (sin "/")<input placeholder="saludo_inicial" /></label>
                    <label className="field">Disponibilidad<select defaultValue="global"><option value="global">Global</option></select></label>
                  </div>
                  <label className="field">Contenido<textarea placeholder="Hola, como estas?" /></label>
                  <div className="template-actions"><button className="primary" type="button">Guardar</button><button className="secondary" type="button">Nuevo</button></div>
                  <div className="quick-table">
                    {["dale", "Guille firma", "invito"].map((name) => (
                      <div key={name}><strong>{name}</strong><span>/{name.toLowerCase().replace(/\s+/g, "_")}</span><p>por favor leer detenidamente el presupuesto...</p><button type="button">Editar</button></div>
                    ))}
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
                  <div className="template-preview">Selecciona una plantilla para ver el contenido.</div>
                  <div className="template-warning">Recorda: Marketing requiere opt-in del contacto y se contabiliza como business-initiated si pasaron 24 h.</div>
                  <footer>
                    <button className="secondary" onClick={() => setTemplateComposerOpen(false)} type="button">Cancelar</button>
                    <button className="primary" disabled={sendingTemplate || !selectedTemplateId} type="submit">{sendingTemplate ? "Enviando" : "Enviar"}</button>
                  </footer>
                  {templateMessage ? <span className={templateMessage.includes("enviada") ? "ok inline" : "warn"}>{templateMessage}</span> : null}
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
                className={activeConversationTab === "notes" ? "active" : ""}
                onClick={() => setActiveConversationTab("notes")}
                type="button"
              >
                <FileText size={17} />
                Notas internas
                <span>{notes.length}</span>
              </button>
            </div>

            <div className={`conversation-workspace ${activeConversationTab === "notes" ? "show-notes" : ""}`}>
              <div className="thread-panel">
                {loadingMessages ? <div className="empty-state">Cargando mensajes...</div> : null}
                {messageError ? <div className="empty-state warn">{messageError}</div> : null}
                {!loadingMessages && !messageError && messages.length ? (
                  <div className="message-thread" ref={messageThreadRef}>
                    {messages.map((message) => (
                      <article className={`chat-bubble ${message.direction} ${isAudioMessage(message) ? "audio-bubble" : ""}`} key={message.id}>
                        {!isAudioMessage(message) && message.body ? <p>{message.body}</p> : null}
                        {message.media_id ? <MessageMedia message={message} /> : null}
                        <small>
                          {message.direction === "inbound" ? "Cliente" : "Febo AI"} - {formatMessageTime(message.created_at)}
                        </small>
                        {message.direction === "outbound" && message.whatsapp_status ? <DeliveryStatus message={message} /> : null}
                      </article>
                    ))}
                    <div ref={threadEndRef} />
                  </div>
                ) : null}
                {!loadingMessages && !messageError && !messages.length ? (
                  <div className="empty-state">Contacto importado sin historial de conversacion.</div>
                ) : null}
              </div>
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
            </div>

            {activeConversationTab === "chat" ? (
              <form
              className="reply-composer"
              onSubmit={sendManualReply}
            >
              <input
                accept="image/png,image/jpeg,image/webp,video/mp4,video/3gpp,audio/aac,audio/mp4,audio/mpeg,audio/ogg,audio/wav,.mp4,.3gp,.m4a,.aac,.mp3,.ogg,.wav,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                hidden
                onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                ref={attachmentInputRef}
                type="file"
              />
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
                    onClick={() => setActiveConversationTab("chat")}
                    type="button"
                  >
                    Conversacion
                  </button>
                  <button
                    className="notes-tab"
                    onClick={() => setActiveConversationTab("notes")}
                    type="button"
                  >
                    Notas internas
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
                <textarea
                  disabled={sendingReply}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder={replyFile ? "Mensaje opcional para acompanar el archivo" : "Escribir respuesta"}
                  value={replyText}
                />
                <button className="primary" disabled={sendingReply || preparingRecording || (!replyText.trim() && !replyFile)} type="submit">
                  <SendHorizonal size={18} />
                  {sendingReply ? "Enviando" : replyFile ? getAttachmentSendLabel(replyFile) : "Enviar"}
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
                    className="notes-tab active"
                    onClick={() => setActiveConversationTab("notes")}
                    type="button"
                  >
                    Notas internas
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
    <span className={`delivery-status ${failed ? "failed" : message.whatsapp_status ?? ""}`} title={message.whatsapp_error ?? undefined}>
      {statusIcon}
      {formatDeliveryStatus(message)}
    </span>
  );
}

function formatDeliveryStatus(message: ConversationMessage) {
  if (message.whatsapp_status === "failed") {
    return `Fallo WhatsApp: ${message.whatsapp_error ?? "Meta no lo entrego"}`;
  }

  const labels: Record<string, string> = {
    accepted: "Aceptado por Meta",
    sent: "Enviado",
    delivered: "Entregado",
    read: "Leido"
  };

  return labels[message.whatsapp_status ?? ""] ?? message.whatsapp_status ?? "";
}

function MessageMedia({ message }: { message: ConversationMessage }) {
  const src = `/api/message-media?messageId=${message.id}`;
  const mimeType = message.media_mime_type ?? "";
  const filename = message.media_filename ?? "archivo";

  if (mimeType.startsWith("image/")) {
    return <img alt={filename} className="message-image" src={src} />;
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
  return file.size > DIRECT_ATTACHMENT_UPLOAD_LIMIT_BYTES;
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

  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }

  if (extension === "mp4") {
    return "video/mp4";
  }

  if (extension === "3gp") {
    return "video/3gpp";
  }

  return mimeType;
}

function isSupportedClientAudio(mimeType: string) {
  const raw = mimeType.trim().toLowerCase();
  const normalized = raw.split(";")[0].trim();

  if (normalized === "audio/mp4" && raw.includes("opus")) {
    return false;
  }

  return ["audio/aac", "audio/amr", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-wav"].includes(normalized);
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

  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);

  if (!sampleCount) {
    return null;
  }

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
  view.setUint32(cursor, sampleRate, true);
  cursor += 4;
  view.setUint32(cursor, sampleRate * 2, true);
  cursor += 4;
  view.setUint16(cursor, 2, true);
  cursor += 2;
  view.setUint16(cursor, 16, true);
  cursor += 2;
  writeAscii(view, cursor, "data");
  cursor += 4;
  view.setUint32(cursor, sampleCount * 2, true);
  cursor += 4;

  for (const chunk of chunks) {
    for (const sample of chunk) {
      view.setInt16(cursor, sample, true);
      cursor += 2;
    }
  }

  return new File([buffer], `audio-febo-${Date.now()}.wav`, { type: "audio/wav" });
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
      <div className="panel-title">
        <Bot size={18} />
        Probar IA
      </div>
      <form className="tester" onSubmit={submit}>
        <label className="field">
          Telefono
          <input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="field">
          Mensaje
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
        </label>
        <button className="primary" disabled={loading} type="submit">
          <SendHorizonal size={18} />
          {loading ? "Generando" : "Enviar prueba"}
        </button>
        {error ? <span className="warn">{error}</span> : null}
        <div className="answer-box">
          {answer ? (
            <>
              <p>{answer.respuesta}</p>
              <span>
                {answer.consultype} - {answer.escalar ? "escala" : "no escala"}
              </span>
            </>
          ) : (
            <span>La respuesta aparece aca.</span>
          )}
        </div>
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

function getReplySendError(response: Response, payload: { error?: string } | null) {
  if (response.status === 413) {
    return "El archivo es demasiado grande para subirlo directo desde FEBO. Para videos grandes vamos a usar link/YouTube o almacenamiento externo.";
  }

  if (payload?.error) {
    return payload.error.length > 240 ? `${payload.error.slice(0, 240)}...` : payload.error;
  }

  return `No pudimos enviar el mensaje (${response.status}).`;
}
