"use client";

import {
  Bot,
  ChevronLeft,
  CircleUserRound,
  Filter,
  Inbox,
  KeyRound,
  LogOut,
  MessageSquareText,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  SendHorizonal,
  Smartphone,
  UserCheck,
  UserPlus
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AppUser, ConversationMessage, ConversationSummary, UserAdminSummary } from "@/lib/crm";

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
          <button className="icon-button" onClick={() => window.location.reload()} title="Actualizar" type="button">
            <RefreshCcw size={18} />
          </button>
          <button className="icon-button" onClick={logout} title="Salir" type="button">
            <LogOut size={18} />
          </button>
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
  const [activeTool, setActiveTool] = useState<"conversations" | "users" | "ai">("conversations");

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
        <button className={activeTool === "users" ? "active" : ""} onClick={() => setActiveTool("users")} type="button">
          <ShieldCheck size={18} />
          Usuarios y accesos
        </button>
        <button className={activeTool === "ai" ? "active" : ""} onClick={() => setActiveTool("ai")} type="button">
          <Bot size={18} />
          Probar IA
        </button>
      </nav>

      <div className="tool-content">
        {activeTool === "conversations" ? (
          <InboxList conversations={conversations} currentUser={currentUser} users={users} />
        ) : null}
        {activeTool === "users" ? <AdminUsersPanel currentUser={currentUser} initialUsers={adminUsers} /> : null}
        {activeTool === "ai" ? <AgentTester /> : null}
      </div>
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
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [filters, setFilters] = useState({
    query: "",
    consultype: "all",
    status: "all",
    assignedTo: "all"
  });
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0], [items, selectedId]);

  useEffect(() => {
    let active = true;

    async function loadMessages() {
      if (!selected?.id) {
        setMessages([]);
        return;
      }

      setLoadingMessages(true);
      setMessageError("");

      const response = await fetch(`/api/conversation-messages?conversationId=${selected.id}`);
      const payload = await readJsonResponse(response);

      if (!active) {
        return;
      }

      setLoadingMessages(false);

      if (!response.ok) {
        setMessages([]);
        setMessageError(payload?.error ?? "No pudimos cargar la conversacion.");
        return;
      }

      setMessages(payload?.messages ?? []);
    }

    void loadMessages();

    return () => {
      active = false;
    };
  }, [selected?.id]);

  async function refreshConversations(nextFilters = filters) {
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
    const nextItems = payload?.conversations ?? [];
    setItems(nextItems);

    if (!nextItems.some((item: ConversationSummary) => item.id === selectedId)) {
      setSelectedId(nextItems[0]?.id ?? "");
      setMobileDetailOpen(false);
    }
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
      const messagesResponse = await fetch(`/api/conversation-messages?conversationId=${conversationId}`);
      const payload = await readJsonResponse(messagesResponse);
      setMessages(payload?.messages ?? []);
    }
  }

  async function sendManualReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected?.id || !replyText.trim()) {
      return;
    }

    setSendingReply(true);
    setReplyError("");

    const response = await fetch("/api/conversation-messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: selected.id, text: replyText.trim() })
    });
    const payload = await readJsonResponse(response);

    setSendingReply(false);

    if (!response.ok) {
      setReplyError(payload?.error ?? "No pudimos enviar el mensaje.");
      return;
    }

    setReplyText("");
    setMessages(payload?.messages ?? []);
    await refreshConversations();
  }

  return (
    <div className={`inbox-panel ${mobileDetailOpen ? "show-detail" : "show-list"}`}>
      <div className="conversation-list">
        <div className="panel-title">
          <MessageSquareText size={18} />
          Conversaciones
          <span>{items.length}</span>
        </div>
        <div className="filters">
          <label className="search-field">
            <Search size={16} />
            <input
              placeholder="Buscar nombre o telefono"
              value={filters.query}
              onChange={(event) => updateFilters({ query: event.target.value })}
            />
          </label>
          <div className="filter-row">
            <Filter size={16} />
            <select onChange={(event) => updateFilters({ consultype: event.target.value })} value={filters.consultype}>
              <option value="all">Todas las etiquetas</option>
              <option value="caliente">Caliente</option>
              <option value="comparador">Comparador</option>
              <option value="sin-perforacion">Sin perforacion</option>
              <option value="proyecto-futuro">Proyecto futuro</option>
              <option value="informacion">Informacion</option>
              <option value="seguimiento">Seguimiento</option>
              <option value="otro">Otro</option>
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
              <span className={`status ${selected.status}`}>{selected.status}</span>
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
              <select
                onChange={(event) => patchConversation(selected.id, { assignedTo: event.target.value || null })}
                value={selected.assigned_to ?? ""}
              >
                <option value="">Sin asignar</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
              <select
                onChange={(event) => patchConversation(selected.id, { status: event.target.value })}
                value={selected.status}
              >
                <option value="open">Abierta</option>
                <option value="waiting">Esperando</option>
                <option value="quoted">Cotizada</option>
                <option value="hot">Caliente</option>
                <option value="handoff">Humano</option>
                <option value="closed">Cerrada</option>
                <option value="lost">Perdida</option>
              </select>
            </div>

            <div className="detail-grid">
              <Info label="Etiqueta" value={selected.consultype} />
              <Info label="Sentimiento" value={selected.sentiment} />
              <Info label="Asignado" value={selected.assigned_name ?? "Sin asignar"} />
              <Info label="IA" value={selected.ai_enabled ? "Activa" : "Pausada"} />
            </div>

            <div className="thread-panel">
              <div className="thread-title">
                <MessageSquareText size={17} />
                Conversacion
                <span>{messages.length}</span>
              </div>
              {loadingMessages ? <div className="empty-state">Cargando mensajes...</div> : null}
              {messageError ? <div className="empty-state warn">{messageError}</div> : null}
              {!loadingMessages && !messageError && messages.length ? (
                <div className="message-thread">
                  {messages.map((message) => (
                    <article className={`chat-bubble ${message.direction}`} key={message.id}>
                      <p>{message.body}</p>
                      <small>
                        {message.direction === "inbound" ? "Cliente" : "Febo AI"} · {formatMessageTime(message.created_at)}
                      </small>
                    </article>
                  ))}
                </div>
              ) : null}
              {!loadingMessages && !messageError && !messages.length ? (
                <div className="empty-state">Contacto importado sin historial de conversacion.</div>
              ) : null}
            </div>

            <form className="reply-composer" onSubmit={sendManualReply}>
              <textarea
                disabled={sendingReply}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Escribir respuesta"
                value={replyText}
              />
              <button className="primary" disabled={sendingReply || !replyText.trim()} type="submit">
                <SendHorizonal size={18} />
                {sendingReply ? "Enviando" : "Enviar"}
              </button>
              {replyError ? <span className="warn">{replyError}</span> : null}
            </form>
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
