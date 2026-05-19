"use client";

import {
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
  ChevronLeft,
  CircleUserRound,
  Clock3,
  FileText,
  Filter,
  ImageIcon,
  Inbox,
  KeyRound,
  LogOut,
  MessageSquareText,
  Mic,
  Paperclip,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  SendHorizonal,
  Smartphone,
  Square,
  UserCheck,
  UserPlus,
  X
} from "lucide-react";
import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { AppUser, ConversationMessage, ConversationNote, ConversationSummary, MessageTemplate, UserAdminSummary } from "@/lib/crm";

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
      <header className="app-header">
        <div>
          <p className="eyebrow">Febo AI CRM</p>
          <h1>Inbox comercial</h1>
          <span className="muted">
            {currentUser.full_name} · {currentUser.role}
          </span>
        </div>
        <div className="header-actions">
          <span className="install-hint">
            <Smartphone size={16} />
            PWA lista para celu
          </span>
          {currentUser.role !== "admin" ? (
            <>
              <button className="icon-button" onClick={() => window.location.reload()} title="Actualizar" type="button">
                <RefreshCcw size={18} />
              </button>
              <button className="icon-button" onClick={logout} title="Salir" type="button">
                <LogOut size={18} />
              </button>
            </>
          ) : null}
        </div>
      </header>

      {!dbConfigured ? (
        <section className="notice">Falta configurar DATABASE_URL. El inbox queda listo, pero todavia no puede leer Neon.</section>
      ) : null}

      <section className="stat-grid">
        <Metric label="Contactos" value={stats.contacts} />
        <Metric label="Conversaciones" value={stats.conversations} />
        <Metric label="Escaladas" value={stats.handoffs} />
        <Metric label="Calientes" value={stats.hot} />
      </section>

      {currentUser.role === "admin" ? (
        <AdminToolWorkspace
          adminUsers={adminUsers}
          conversations={conversations}
          currentUser={currentUser}
          users={users}
        />
      ) : (
        <section className="workspace-grid">
          <InboxList conversations={conversations} currentUser={currentUser} users={users} />
          <AgentTester />
        </section>
      )}
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

function AdminToolWorkspace({
  adminUsers,
  conversations,
  currentUser,
  users
}: {
  adminUsers: UserAdminSummary[];
  conversations: ConversationSummary[];
  currentUser: AppUser;
  users: AppUser[];
}) {
  const [activeTool, setActiveTool] = useState<"conversations" | "templates" | "users" | "ai">("conversations");

  return (
    <section className="admin-workspace">
      <nav className="tool-sidebar" aria-label="Herramientas de administrador">
        <button
          className={activeTool === "conversations" ? "active" : ""}
          onClick={() => setActiveTool("conversations")}
          type="button"
        >
          <Inbox size={18} />
          Conversaciones
        </button>
        <button
          className={activeTool === "templates" ? "active" : ""}
          onClick={() => setActiveTool("templates")}
          type="button"
        >
          <MessageSquareText size={18} />
          Plantillas
        </button>
        <button className={activeTool === "users" ? "active" : ""} onClick={() => setActiveTool("users")} type="button">
          <ShieldCheck size={18} />
          Usuarios y accesos
        </button>
        <button className={activeTool === "ai" ? "active" : ""} onClick={() => setActiveTool("ai")} type="button">
          <Bot size={18} />
          Probar IA
        </button>
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
          <InboxList conversations={conversations} currentUser={currentUser} users={users} />
        ) : null}
        {activeTool === "templates" ? <TemplatesPanel /> : null}
        {activeTool === "users" ? <AdminUsersPanel currentUser={currentUser} initialUsers={adminUsers} /> : null}
        {activeTool === "ai" ? <AgentTester /> : null}
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
            <span>{template.name} · {template.language_code}</span>
            <small>{template.active ? "activa" : "inactiva"} · {template.body || "Sin texto local"}</small>
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
  users
}: {
  conversations: ConversationSummary[];
  currentUser: AppUser;
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
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [creatingContact, setCreatingContact] = useState(false);
  const [templateComposerOpen, setTemplateComposerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateParameters, setTemplateParameters] = useState("");
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");
  const [newContact, setNewContact] = useState({
    displayName: "",
    phone: "",
    templateId: "",
    parameters: ""
  });
  const [newContactMessage, setNewContactMessage] = useState("");
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
  const [filters, setFilters] = useState({
    query: "",
    consultype: "all",
    status: "all",
    assignedTo: "all"
  });
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0], [items, selectedId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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
      threadEndRef.current?.scrollIntoView({ block: "end" });
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

    if (nextFilters.consultype !== "all") {
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

    const nextItems = payload?.conversations ?? [];
    setItems(nextItems);

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
      setNewContact((current) => ({ ...current, templateId: current.templateId || activeTemplates[0]?.id || "" }));
      setSelectedTemplateId((current) => current || activeTemplates[0]?.id || "");
    }
  }

  async function sendTemplateToSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected?.phone || !selectedTemplateId) {
      setTemplateMessage("Elegí una plantilla para enviar.");
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
    setSelectedId(payload?.conversationId ?? selected.id);
    setMessages(payload?.messages ?? []);
    setTemplateParameters("");
    setTemplateMessage("Plantilla enviada.");
    await refreshConversations(filters, { silent: true });
  }

  async function createContactWithTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewContactMessage("");
    setCreatingContact(true);
    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: newContact.phone,
        displayName: newContact.displayName,
        templateId: newContact.templateId || undefined,
        parameters: newContact.parameters
          .split(/\r?\n|,/)
          .map((value) => value.trim())
          .filter(Boolean)
      })
    });
    const payload = await readJsonResponse(response);
    setCreatingContact(false);

    if (!response.ok) {
      setNewContactMessage(payload?.error ?? "No pudimos crear el contacto.");
      return;
    }

    setItems(payload?.conversations ?? []);
    setSelectedId(payload?.conversationId ?? "");
    setMessages(payload?.messages ?? []);
    setNewContact({ displayName: "", phone: "", templateId: templates[0]?.id ?? "", parameters: "" });
    setNewContactOpen(false);
    setMobileDetailOpen(true);
  }

  function updateFilters(next: Partial<typeof filters>) {
    const nextFilters = { ...filters, ...next };
    setFilters(nextFilters);
    void refreshConversations(nextFilters);
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

  async function sendManualReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected?.id || (!replyText.trim() && !replyFile)) {
      return;
    }

    setSendingReply(true);
    setReplyError("");
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

    const response = await fetch("/api/conversation-messages", {
      method: "POST",
      headers: replyFile ? undefined : { "content-type": "application/json" },
      body
    });
    const payload = await readJsonResponse(response);

    setSendingReply(false);

    if (!response.ok) {
      setReplyError(payload?.error ?? "No pudimos enviar el mensaje.");
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

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDraggingFile(false);
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
          <MessageSquareText size={18} />
          Conversaciones
          <span>{items.length}</span>
        </div>
        <div className="list-quick-actions">
          <button className="secondary new-contact-button" onClick={() => setNewContactOpen(!newContactOpen)} type="button">
            <UserPlus size={17} />
            Nuevo contacto
          </button>
          <label className="search-field">
            <Search size={16} />
            <input
              placeholder="Buscar nombre o telefono"
              value={filters.query}
              onChange={(event) => updateFilters({ query: event.target.value })}
            />
          </label>
        </div>
        {newContactOpen ? (
          <form className="new-contact-card" onSubmit={createContactWithTemplate}>
            <label className="field">
              Nombre
              <input value={newContact.displayName} onChange={(event) => setNewContact({ ...newContact, displayName: event.target.value })} />
            </label>
            <label className="field">
              WhatsApp
              <input
                placeholder="Ej: 1125750323"
                value={newContact.phone}
                onChange={(event) => setNewContact({ ...newContact, phone: event.target.value })}
                required
              />
            </label>
            <label className="field">
              Plantilla
              <select value={newContact.templateId} onChange={(event) => setNewContact({ ...newContact, templateId: event.target.value })}>
                <option value="">Crear sin enviar</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label} · {template.language_code}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Variables
              <textarea
                placeholder="Una por linea si la plantilla usa {{1}}, {{2}}"
                value={newContact.parameters}
                onChange={(event) => setNewContact({ ...newContact, parameters: event.target.value })}
              />
            </label>
            <button className="primary" disabled={creatingContact} type="submit">
              <SendHorizonal size={17} />
              {creatingContact ? "Enviando" : newContact.templateId ? "Crear y enviar" : "Crear contacto"}
            </button>
            {!templates.length ? <span className="muted">Primero carga una plantilla aprobada en la solapa Plantillas.</span> : null}
            {newContactMessage ? <span className="warn">{newContactMessage}</span> : null}
          </form>
        ) : null}
        <div className="filters">
          <div className="filter-row">
            <Filter size={16} />
            <select onChange={(event) => updateFilters({ consultype: event.target.value })} value={filters.consultype}>
              <option value="all">Todas las etiquetas</option>
              {CONSULTYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select onChange={(event) => updateFilters({ status: event.target.value })} value={filters.status}>
              <option value="all">Todos los estados</option>
              <option value="open">Abiertas</option>
              <option value="waiting">Esperando</option>
              <option value="quoted">Cotizadas</option>
              <option value="hot">Calientes</option>
              <option value="handoff">Humano</option>
              <option value="closed">Cerradas</option>
              <option value="lost">Perdidas</option>
            </select>
            <select onChange={(event) => updateFilters({ assignedTo: event.target.value })} value={filters.assignedTo}>
              <option value="all">Todos</option>
              <option value="mine">Mias</option>
              <option value="unassigned">Sin asignar</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {items.length ? (
          items.map((conversation) => (
            <button
              className={`conversation-row ${conversation.id === selected?.id ? "active" : ""}`}
              key={conversation.id}
              onClick={() => {
                setSelectedId(conversation.id);
                setMobileDetailOpen(true);
              }}
              type="button"
            >
              <span className="row-main">
                <strong>{conversation.display_name || conversation.phone}</strong>
                <small>{conversation.last_message || "Importado desde Hariaz"}</small>
              </span>
              <span className={`tag ${conversation.consultype}`}>{conversation.consultype}</span>
            </button>
          ))
        ) : (
          <div className="empty-state">Cuando importemos Hariaz o entren mensajes, van a aparecer aca.</div>
        )}
      </div>

      <div className="conversation-detail">
        {selected ? (
          <>
            <button className="back-button" onClick={() => setMobileDetailOpen(false)} type="button">
              <ChevronLeft size={18} />
              Volver
            </button>
            <div className="detail-head">
              <div>
                <h2>{selected.display_name || "Sin nombre"}</h2>
                <span>{selected.phone}</span>
              </div>
              <span className={`status ${selected.status}`}>{getStatusLabel(selected.status)}</span>
            </div>

            <div className="toolbar">
              <button
                className="secondary"
                onClick={() => patchConversation(selected.id, { assignedTo: currentUser.id })}
                type="button"
              >
                <CircleUserRound size={17} />
                Tomar
              </button>
              <button
                className="secondary"
                onClick={() => patchConversation(selected.id, { aiEnabled: !selected.ai_enabled })}
                type="button"
              >
                <Bot size={17} />
                {selected.ai_enabled ? "Pausar IA" : "Activar IA"}
              </button>
              <button className="secondary" onClick={() => setTemplateComposerOpen(!templateComposerOpen)} type="button">
                <FileText size={17} />
                Plantilla
              </button>
              <details className="toolbar-menu">
                <summary>Transferir</summary>
                <select
                  onChange={(event) =>
                    patchConversation(selected.id, {
                      assignedTo: event.target.value || null,
                      aiEnabled: false,
                      status: event.target.value ? "handoff" : selected.status
                    })
                  }
                  value={selected.assigned_to ?? ""}
                >
                  <option value="">Sin asignar</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </details>
              <details className="toolbar-menu">
                <summary>{getStatusLabel(selected.status)}</summary>
                <select onChange={(event) => patchConversation(selected.id, { status: event.target.value })} value={selected.status}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </details>
              <details className="toolbar-menu">
                <summary>{getConsultypeLabel(selected.consultype)}</summary>
                <select
                  onChange={(event) => patchConversation(selected.id, { consultype: event.target.value })}
                  value={selected.consultype}
                >
                  {CONSULTYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </details>
            </div>

            {templateComposerOpen ? (
              <form className="template-composer" onSubmit={sendTemplateToSelected}>
                <label className="field">
                  Plantilla para este contacto
                  <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                    <option value="">Elegir plantilla</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label} · {template.language_code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Variables
                  <textarea
                    placeholder="Solo si la plantilla usa {{1}}, {{2}}"
                    value={templateParameters}
                    onChange={(event) => setTemplateParameters(event.target.value)}
                  />
                </label>
                <div className="template-actions">
                  <button className="primary" disabled={sendingTemplate || !selectedTemplateId} type="submit">
                    <SendHorizonal size={17} />
                    {sendingTemplate ? "Enviando" : "Enviar plantilla"}
                  </button>
                  <button
                    className="secondary"
                    disabled={sendingTemplate}
                    onClick={() => {
                      setTemplateComposerOpen(false);
                      setTemplateMessage("");
                    }}
                    type="button"
                  >
                    Cancelar
                  </button>
                </div>
                {!templates.length ? <span className="muted">Primero carga una plantilla aprobada en la solapa Plantillas.</span> : null}
                {templateMessage ? <span className={templateMessage.includes("enviada") ? "ok inline" : "warn"}>{templateMessage}</span> : null}
              </form>
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

            {activeConversationTab === "chat" ? (
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
                        {message.direction === "inbound" ? "Cliente" : "Febo AI"} · {formatMessageTime(message.created_at)}
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
            ) : (
              <div className="notes-panel">
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
              </div>
            )}

            {activeConversationTab === "chat" ? (
              <form
              className={`reply-composer ${draggingFile ? "dragging" : ""}`}
              onDragLeave={() => setDraggingFile(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setDraggingFile(true);
              }}
              onDrop={handleDrop}
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
              <textarea
                disabled={sendingReply}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder={replyFile ? "Mensaje opcional para acompanar el archivo" : "Escribir respuesta"}
                value={replyText}
              />
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
              <div className="composer-actions">
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
                <button className="primary" disabled={sendingReply || preparingRecording || (!replyText.trim() && !replyFile)} type="submit">
                  <SendHorizonal size={18} />
                  {sendingReply ? "Enviando" : replyFile ? getAttachmentSendLabel(replyFile) : "Enviar"}
                </button>
              </div>
              {replyError ? <span className="warn">{replyError}</span> : null}
              </form>
            ) : null}
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
  const mimeType = file.type.split(";")[0].trim().toLowerCase();
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

function isSupportedClientAudio(mimeType: string) {
  const raw = mimeType.trim().toLowerCase();
  const normalized = raw.split(";")[0].trim();

  if (normalized === "audio/mp4" && raw.includes("opus")) {
    return false;
  }

  return ["audio/aac", "audio/amr", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-wav"].includes(normalized);
}

function getAttachmentSendLabel(file: File) {
  if (file.type.startsWith("audio/")) {
    return "Enviar audio";
  }

  if (file.type.startsWith("image/")) {
    return "Enviar imagen";
  }

  if (file.type.startsWith("video/")) {
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
                {answer.consultype} · {answer.escalar ? "escala" : "no escala"}
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
    return null;
  }
}
