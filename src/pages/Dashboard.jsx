import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(n || 0) + " FCFA";
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
const initials = (name = "") =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState(null);
  const [me, setMe] = useState(null);
  const [members, setMembers] = useState([]); // {member_id, profile_id, full_name, role}
  const [contributions, setContributions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [activity, setActivity] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, role, family_id")
      .eq("id", user.id)
      .single();
    if (!profile?.family_id) { setLoading(false); return; }
    setMe(profile);

    const familyId = profile.family_id;

    const [{ data: fam }, { data: mem }, { data: contribs }, { data: exp }, { data: log }] = await Promise.all([
      supabase.from("families").select("id, name, invite_code").eq("id", familyId).single(),
      supabase.from("members").select("id, profile_id, status, profiles(full_name, role)").eq("family_id", familyId),
      supabase.from("contributions")
        .select("id, amount, contribution_date, description, status, member_id, members(profiles(full_name))")
        .eq("family_id", familyId).is("deleted_at", null)
        .order("contribution_date", { ascending: false }),
      supabase.from("expenses")
        .select("id, amount, category, expense_date, description")
        .eq("family_id", familyId).is("deleted_at", null)
        .order("expense_date", { ascending: false }),
      supabase.from("activity_logs")
        .select("id, action, details, created_at, profiles(full_name)")
        .eq("family_id", familyId).order("created_at", { ascending: false }).limit(8),
    ]);

    setFamily(fam);
    setMembers((mem || []).map((m) => ({
      member_id: m.id,
      profile_id: m.profile_id,
      full_name: m.profiles?.full_name || "—",
      role: m.profiles?.role || "MEMBER",
      status: m.status,
    })));
    setContributions((contribs || []).map((c) => ({
      ...c,
      member_name: c.members?.profiles?.full_name || "—",
    })));
    setExpenses(exp || []);
    setActivity(log || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalCotise = contributions.reduce((s, c) => s + Number(c.amount), 0);
  const totalDepenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const enAttente = contributions.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
  const solde = totalCotise - totalDepenses;
  const dernier = contributions[0];
  const memberTotal = (profileId) =>
    contributions.filter((c) => c.members?.profiles ? undefined : true)
      .filter((c) => members.find((m) => m.member_id === c.member_id)?.profile_id === profileId)
      .reduce((s, c) => s + Number(c.amount), 0);

  async function submitPayment(e) {
    e.preventDefault();
    setSaving(true);
    const form = e.target;
    const member_id = form.member.value;
    const amount = Number(form.amount.value);
    const contribution_date = form.date.value;
    const description = form.desc.value;
    await supabase.from("contributions").insert({
      family_id: family.id, member_id, amount, contribution_date, description,
      status: "confirmed", created_by: me.id,
    });
    await supabase.from("activity_logs").insert({
      family_id: family.id, actor_id: me.id, action: "contribution_added",
      details: { amount, member_id },
    });
    form.reset();
    setShowPayment(false);
    setSaving(false);
    load();
  }

  async function submitExpense(e) {
    e.preventDefault();
    setSaving(true);
    const form = e.target;
    const category = form.category.value;
    const amount = Number(form.amount.value);
    const expense_date = form.date.value;
    const description = form.desc.value;
    await supabase.from("expenses").insert({
      family_id: family.id, amount, category, expense_date, description, created_by: me.id,
    });
    await supabase.from("activity_logs").insert({
      family_id: family.id, actor_id: me.id, action: "expense_added",
      details: { amount, category },
    });
    form.reset();
    setShowExpense(false);
    setSaving(false);
    load();
  }

  if (loading) {
    return <div style={{ padding: 40, color: "#EDE7DC", background: "#0A0C0E", minHeight: "100vh" }}>Chargement…</div>;
  }
  if (!family) {
    return <div style={{ padding: 40, color: "#EDE7DC", background: "#0A0C0E", minHeight: "100vh" }}>Aucune famille associée à ce compte.</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A0C0E", color: "#EDE7DC", fontFamily: "'Sora',sans-serif" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "rgba(10,12,14,.8)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(237,231,220,.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18 }}>LA CAISSE <span style={{ color: "#E8913C" }}>.</span></span>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9EA5A8", borderLeft: "1px solid rgba(237,231,220,.1)", paddingLeft: 12 }}>{family.name?.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, background: "#101317", border: "1px solid rgba(237,231,220,.1)", borderRadius: 999, padding: "6px 12px" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#2E6B72" }} />
          <span style={{ fontWeight: 600 }}>{me?.full_name}</span>
          <span style={{ fontSize: 10, textTransform: "uppercase", color: "#6C7378" }}>{me?.role}</span>
        </div>
      </header>

      <main style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
          <div>
            <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.15em", color: "#E8913C", fontWeight: 600 }}>
              MIS À JOUR : {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 800, margin: "4px 0 0" }}>SYNTHÈSE FINANCIÈRE</h1>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => { setShowExpense((v) => !v); setShowPayment(false); }} style={btnGhost}>Saisir une dépense</button>
            <button onClick={() => { setShowPayment((v) => !v); setShowExpense(false); }} style={btnSolid}>Nouveau paiement</button>
          </div>
        </div>

        {showPayment && (
          <form onSubmit={submitPayment} style={panelForm}>
            <Field label="Membre">
              <select name="member" required style={input}>
                {members.map((m) => <option key={m.member_id} value={m.member_id}>{m.full_name}</option>)}
              </select>
            </Field>
            <Field label="Montant (FCFA)"><input name="amount" type="number" min="1" required style={input} /></Field>
            <Field label="Date"><input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} style={input} /></Field>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <button disabled={saving} type="submit" style={{ ...btnSolid, flex: 1 }}>Enregistrer</button>
              <button type="button" onClick={() => setShowPayment(false)} style={btnGhost}>Annuler</button>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Motif (optionnel)"><input name="desc" type="text" style={input} /></Field>
            </div>
          </form>
        )}

        {showExpense && (
          <form onSubmit={submitExpense} style={panelForm}>
            <Field label="Catégorie"><input name="category" type="text" required style={input} /></Field>
            <Field label="Montant (FCFA)"><input name="amount" type="number" min="1" required style={input} /></Field>
            <Field label="Date"><input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} style={input} /></Field>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <button disabled={saving} type="submit" style={{ ...btnSolid, flex: 1 }}>Enregistrer</button>
              <button type="button" onClick={() => setShowExpense(false)} style={btnGhost}>Annuler</button>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Description (optionnel)"><input name="desc" type="text" style={input} /></Field>
            </div>
          </form>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 16, marginBottom: 40 }}>
          <Kpi label="TOTAL COTISÉ" value={fmt(totalCotise)} />
          <Kpi label="DERNIER PAIEMENT" value={dernier ? fmt(dernier.amount) : "—"} sub={dernier ? fmtDate(dernier.contribution_date) : ""} color="#2E6B72" />
          <Kpi label="EN ATTENTE" value={fmt(enAttente)} color="#E8913C" />
          <Kpi label="DÉPENSES (TOTAL)" value={fmt(totalDepenses)} />
          <Kpi label="SOLDE ACTUEL" value={fmt(solde)} highlight />
        </div>

        <h2 style={h2}>MEMBRES</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 16, marginBottom: 32 }}>
          {members.map((m) => {
            const total = memberTotal(m.profile_id);
            return (
              <div key={m.member_id} style={{ ...panel, padding: 16, textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: 999, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", fontWeight: 700, background: "rgba(237,231,220,.1)", border: "1px solid rgba(237,231,220,.2)" }}>
                  {initials(m.full_name)}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.full_name}</div>
                <div style={{ fontSize: 9.5, textTransform: "uppercase", color: "#6C7378", marginTop: 4 }}>{m.role}</div>
                <div style={{ fontSize: 9.5, textTransform: "uppercase", marginTop: 8, padding: "2px 8px", borderRadius: 4, display: "inline-block", color: total > 0 ? "#2E6B72" : "#6C7378", background: total > 0 ? "rgba(46,107,114,.1)" : "rgba(108,115,120,.1)" }}>
                  {total > 0 ? "À JOUR" : "AUCUN PAIEMENT"}
                </div>
                <div style={{ fontSize: 12, marginTop: 8, fontWeight: 600 }}>{fmt(total)}</div>
              </div>
            );
          })}
        </div>

        <h2 style={h2}>PAIEMENTS ENREGISTRÉS</h2>
        <Table
          head={["MEMBRE", "MONTANT", "DATE", "STATUT"]}
          rows={contributions.map((c) => [
            <div><strong>{c.member_name}</strong>{c.description && <div style={{ fontSize: 10, color: "#6C7378", textTransform: "uppercase" }}>{c.description}</div>}</div>,
            <strong>{fmt(c.amount)}</strong>,
            fmtDate(c.contribution_date),
            <span style={badgeOk}>{c.status === "confirmed" ? "CONFIRMÉ" : c.status.toUpperCase()}</span>,
          ])}
          empty="Aucun paiement enregistré."
        />

        <h2 style={{ ...h2, marginTop: 32 }}>DÉPENSES</h2>
        <Table
          head={["CATÉGORIE", "MONTANT", "DATE"]}
          rows={expenses.map((e) => [
            <div><strong>{e.category}</strong>{e.description && <div style={{ fontSize: 10, color: "#6C7378", textTransform: "uppercase" }}>{e.description}</div>}</div>,
            <strong>{fmt(e.amount)}</strong>,
            fmtDate(e.expense_date),
          ])}
          empty="Aucune dépense enregistrée."
        />

        <h2 style={{ ...h2, marginTop: 32 }}>HISTORIQUE RÉCENT</h2>
        <div style={{ ...panel, padding: 20 }}>
          {activity.length === 0 && <div style={{ color: "#6C7378" }}>Aucune activité récente.</div>}
          {activity.map((a, i) => (
            <div key={a.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < activity.length - 1 ? "1px solid rgba(237,231,220,.08)" : "none" }}>
              <span style={{ fontSize: 10, textTransform: "uppercase", color: i === 0 ? "#E8913C" : "#6C7378", display: "block", marginBottom: 4 }}>
                {fmtDate(a.created_at)}
              </span>
              <p style={{ margin: 0 }}>
                <strong>{a.profiles?.full_name || "Quelqu'un"}</strong> — {describeAction(a.action, a.details)}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function describeAction(action, details = {}) {
  switch (action) {
    case "contribution_added": return `a enregistré un paiement de ${fmt(details.amount)}.`;
    case "expense_added": return `a enregistré une dépense (${details.category || ""}, ${fmt(details.amount)}).`;
    case "family_created": return "a créé l'espace familial.";
    case "join_request_approved": return "a approuvé une demande d'adhésion.";
    case "role_changed": return `a changé un rôle en ${details.new_role || "?"}.`;
    default: return action.replace(/_/g, " ");
  }
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9EA5A8", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
function Kpi({ label, value, sub, color, highlight }) {
  return (
    <div style={{ ...panel, padding: 20, ...(highlight ? { borderColor: "rgba(232,145,60,.3)", background: "linear-gradient(to bottom,#101317,rgba(232,145,60,.06))" } : {}) }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: highlight ? "#E8913C" : "#9EA5A8", display: "block", marginBottom: 8, fontWeight: highlight ? 600 : 400 }}>{label}</span>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: highlight ? 800 : 700, color: color || "#EDE7DC" }}>{value}</div>
      {sub && <span style={{ fontSize: 10, color: "#6C7378", display: "block", marginTop: 4 }}>{sub}</span>}
    </div>
  );
}
function Table({ head, rows, empty }) {
  return (
    <div style={{ border: "1px solid rgba(237,231,220,.1)", borderRadius: 8, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
        <thead style={{ background: "#101317", borderBottom: "1px solid rgba(237,231,220,.1)", color: "#9EA5A8", textTransform: "uppercase", fontSize: 10 }}>
          <tr>{head.map((h) => <th key={h} style={{ padding: 14, textAlign: "left" }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={head.length} style={{ padding: 14, color: "#6C7378" }}>{empty}</td></tr>}
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid rgba(237,231,220,.08)" }}>
              {r.map((c, j) => <td key={j} style={{ padding: 14 }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const panel = { background: "#101317", border: "1px solid rgba(237,231,220,.1)", borderRadius: 8 };
const h2 = { fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 16 };
const btnSolid = { padding: "8px 16px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", background: "#EDE7DC", color: "#0A0C0E", border: "none", borderRadius: 6, cursor: "pointer" };
const btnGhost = { padding: "8px 16px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", background: "transparent", color: "#EDE7DC", border: "1px solid rgba(237,231,220,.2)", borderRadius: 6, cursor: "pointer" };
const input = { width: "100%", padding: "8px 12px", fontSize: 13, background: "#0A0C0E", border: "1px solid rgba(237,231,220,.1)", color: "#EDE7DC", borderRadius: 6 };
const badgeOk = { fontSize: 10, textTransform: "uppercase", fontWeight: 600, padding: "2px 8px", borderRadius: 4, color: "#2E6B72", background: "rgba(46,107,114,.1)", border: "1px solid rgba(46,107,114,.2)" };
const panelForm = { ...panel, padding: 20, marginBottom: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, alignItems: "end" };
