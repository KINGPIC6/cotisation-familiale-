import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { toSafeMessage } from '../utils/errors';
import AppShell from '../components/AppShell';
import { InlineLoading, InlineError } from '../components/StateViews';

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n || 0) + ' FCFA';
}

function monthKey(d) {
  const date = new Date(d);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function monthLabel(d) {
  return new Date(d).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

function last6Months() {
  const arr = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: monthLabel(d) });
  }
  return arr;
}

function translateAction(action) {
  const map = {
    family_created: 'a créé la famille',
    contribution_added: 'a ajouté une cotisation',
    expense_added: 'a ajouté une dépense',
    member_deactivated: 'a désactivé un membre',
    member_reactivated: 'a réactivé un membre',
    join_request_approved: "a accepté une demande d'adhésion",
    join_request_rejected: "a refusé une demande d'adhésion",
    role_changed: 'a modifié un rôle',
  };
  return map[action] || action;
}

const Styles = () => (
  <style>{`
    .db-wrap { display: flex; flex-direction: column; gap: 20px; }
    .db-hero {
      position: relative;
      overflow: hidden;
      border-radius: 20px;
      min-height: 220px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 28px 32px;
      color: #fff;
      background:
        linear-gradient(to right, rgba(10,25,15,.82), rgba(10,25,15,.35)),
        url('https://images.unsplash.com/photo-1609220136736-443140cffec6?q=80&w=1600&auto=format&fit=crop');
      background-size: cover;
      background-position: center;
    }
    .db-hero h1 { margin: 6px 0 4px; font-size: 26px; font-weight: 800; }
    .db-hero p { margin: 0; color: rgba(255,255,255,.85); font-size: 14px; }
    .db-hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.2);
      border-radius: 999px; padding: 8px 14px; margin-top: 14px; font-size: 13px;
    }
    .db-hero-balance {
      background: rgba(20,60,45,.55);
      border: 1px solid rgba(255,255,255,.25);
      border-radius: 16px;
      padding: 16px 22px;
      min-width: 220px;
      backdrop-filter: blur(6px);
    }
    .db-hero-balance-label { display:flex; align-items:center; gap:6px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.8); background:none; border:none; cursor:pointer; padding:0; }
    .db-hero-balance-value { font-size: 26px; font-weight: 800; margin: 6px 0 4px; }
    .db-hero-balance-delta { font-size: 12px; color: #8ef0b3; }

    .db-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .db-kpi { background: #fff; border: 1px solid rgba(15,42,34,.08); border-radius: 16px; padding: 18px; }
    .db-kpi-icon { width: 40px; height: 40px; border-radius: 12px; display:grid; place-items:center; margin-bottom: 12px; font-size: 18px; }
    .db-kpi-label { margin: 0; font-size: 13px; color: #6B7268; }
    .db-kpi-value { margin: 6px 0 2px; font-size: 22px; font-weight: 800; color: #18211D; }
    .db-kpi-delta { font-size: 12px; font-weight: 600; }
    .db-kpi-bars { display:flex; align-items:flex-end; gap:3px; height: 28px; margin: 10px 0; }
    .db-kpi-bar { flex:1; border-radius: 2px 2px 0 0; }
    .db-kpi-link { font-size: 12px; font-weight: 600; text-decoration: none; }

    .db-main-row { display: grid; grid-template-columns: minmax(0,1.05fr) minmax(280px,.45fr); gap: 20px; align-items: start; }
    .db-panel { background: #fff; border: 1px solid rgba(15,42,34,.08); border-radius: 16px; padding: 20px; }
    .db-panel-head { display:flex; align-items:center; justify-content:space-between; margin-bottom: 14px; }
    .db-panel-title { margin:0; font-size:15px; font-weight:700; color:#18211D; display:flex; align-items:center; gap:8px; }
    .db-panel-link { font-size: 12px; font-weight: 600; text-decoration: none; }

    .db-legend { display:flex; gap:14px; font-size:12px; color:#6B7268; margin-bottom: 8px; }
    .db-legend span { display:inline-flex; align-items:center; gap:6px; }
    .db-dot { width:8px; height:8px; border-radius:50%; }

    .db-activity-item { display:flex; align-items:flex-start; gap:12px; padding: 10px 0; border-bottom: 1px solid rgba(15,42,34,.06); }
    .db-activity-item:last-child { border-bottom: none; }
    .db-activity-icon { width:32px; height:32px; border-radius:50%; display:grid; place-items:center; font-size:14px; flex-shrink:0; }
    .db-activity-text { margin:0; font-size:13px; color:#18211D; }
    .db-activity-sub { margin:2px 0 0; font-size:11px; color:#8b9187; }
    .db-activity-amount { margin-left:auto; font-size:13px; font-weight:700; white-space:nowrap; }

    .db-member-item { display:flex; align-items:center; gap:10px; padding: 10px 0; border-bottom: 1px solid rgba(15,42,34,.06); text-decoration:none; color:inherit; }
    .db-member-item:last-child { border-bottom:none; }
    .db-member-avatar { width:36px; height:36px; border-radius:50%; background:#0F2A22; color:#EDE7DC; display:grid; place-items:center; font-size:12px; font-weight:700; flex-shrink:0; }
    .db-member-name { margin:0; font-size:13px; font-weight:700; color:#18211D; }
    .db-member-role { margin:1px 0 0; font-size:11px; color:#8b9187; }
    .db-badge-active { margin-left:auto; font-size:10px; font-weight:700; color:#1E7A4C; background:rgba(30,122,76,.1); padding:3px 8px; border-radius:999px; }

    .db-shortcuts { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .db-shortcut { display:flex; flex-direction:column; gap:10px; padding:16px; border-radius:14px; text-decoration:none; font-size:13px; font-weight:700; }
    .db-shortcut-icon { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; font-size:16px; }

    .db-banner {
      display:flex; align-items:center; justify-content:space-between; gap:16px;
      background: #0F2A22; color:#EDE7DC; border-radius:16px; padding:18px 24px;
      background-image: linear-gradient(to right, rgba(15,42,34,.92), rgba(15,42,34,.75)), url('https://images.unsplash.com/photo-1477414348463-c0eb7f1359b6?q=80&w=1400&auto=format&fit=crop');
      background-size: cover; background-position:center;
    }
    .db-banner p { margin:0; font-style: italic; font-size:14px; }
    .db-banner a { display:inline-flex; align-items:center; gap:6px; background:#E8B24A; color:#0F2A22; border-radius:999px; padding:8px 16px; font-size:13px; font-weight:700; text-decoration:none; white-space:nowrap; }

    .db-footer { display:flex; justify-content:space-between; font-size:11px; color:#8b9187; padding-top: 4px; }
    .db-footer span { display:inline-flex; align-items:center; gap:6px; }

    @media (max-width: 1000px) {
      .db-kpis { grid-template-columns: repeat(2, 1fr); }
      .db-main-row { grid-template-columns: 1fr; }
      .db-hero { flex-direction: column; align-items: flex-start; }
    }
    @media (max-width: 560px) {
      .db-kpis { grid-template-columns: 1fr; }
      .db-shortcuts { grid-template-columns: 1fr; }
    }
  `}</style>
);

function MiniBars({ values, color }) {
  const max = Math.max(1, ...values);
  return (
    <div className="db-kpi-bars">
      {values.map((v, i) => (
        <div key={i} className="db-kpi-bar" style={{ height: `${Math.max(6, (v / max) * 100)}%`, background: color, opacity: 0.35 + (i / values.length) * 0.65 }} />
      ))}
    </div>
  );
}

function LineChart({ months, contribSeries, expenseSeries }) {
  const w = 640;
  const h = 200;
  const padL = 46;
  const padB = 24;
  const max = Math.max(1, ...contribSeries, ...expenseSeries);
  const stepX = (w - padL - 10) / (months.length - 1 || 1);
  const toY = (v) => h - padB - (v / max) * (h - padB - 14);
  const toPts = (series) => series.map((v, i) => `${padL + i * stepX},${toY(v)}`).join(' ');
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="220" style={{ overflow: 'visible' }}>
      {gridVals.map((gv, i) => (
        <g key={i}>
          <line x1={padL} x2={w} y1={toY(gv)} y2={toY(gv)} stroke="rgba(15,42,34,.06)" />
          <text x={0} y={toY(gv) + 4} fontSize="10" fill="#8b9187">{new Intl.NumberFormat('fr-FR').format(gv)}</text>
        </g>
      ))}
      <polyline points={`${padL},${toY(0)} ${toPts(contribSeries)} ${padL + (months.length - 1) * stepX},${toY(0)}`} fill="rgba(30,122,76,.12)" stroke="none" />
      <polyline points={toPts(contribSeries)} fill="none" stroke="#1E7A4C" strokeWidth="2.5" />
      <polyline points={toPts(expenseSeries)} fill="none" stroke="#C0392B" strokeWidth="2.5" />
      {months.map((m, i) => (
        <g key={m.key}>
          <circle cx={padL + i * stepX} cy={toY(contribSeries[i])} r="3.5" fill="#1E7A4C" />
          <circle cx={padL + i * stepX} cy={toY(expenseSeries[i])} r="3.5" fill="#C0392B" />
          <text x={padL + i * stepX} y={h} fontSize="11" fill="#8b9187" textAnchor="middle">{m.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Session expirée, merci de vous reconnecter.');

        const { data: profile, error: eProfile } = await supabase
          .from('profiles').select('*').eq('id', user.id).single();
        if (eProfile) throw eProfile;
        if (!profile?.family_id) {
          if (mounted) setState({ loading: false, error: '', data: { noFamily: true } });
          return;
        }
        const familyId = profile.family_id;

        const [
          { data: family },
          { data: allProfiles, error: eProfiles },
          { data: members, error: eMembers },
          { data: contributions, error: eContrib },
          { data: expenses, error: eExp },
          { data: activity, error: eAct },
        ] = await Promise.all([
          supabase.from('families').select('*').eq('id', familyId).single(),
          supabase.from('profiles').select('id, full_name, role, is_active').eq('family_id', familyId),
          supabase.from('members').select('id, profile_id, status').eq('family_id', familyId),
          supabase.from('contributions').select('id, amount, contribution_date, member_id').eq('family_id', familyId).is('deleted_at', null),
          supabase.from('expenses').select('id, amount, expense_date, category').eq('family_id', familyId).is('deleted_at', null),
          supabase.from('activity_logs').select('id, action, details, created_at, actor:profiles(full_name)').eq('family_id', familyId).order('created_at', { ascending: false }).limit(5),
        ]);

        if (eProfiles || eMembers || eContrib || eExp || eAct) throw eProfiles || eMembers || eContrib || eExp || eAct;

        const totalContributions = (contributions || []).reduce((s, c) => s + Number(c.amount), 0);
        const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
        const balance = totalContributions - totalExpenses;

        const months = last6Months();
        const contribByMonth = Object.fromEntries(months.map((m) => [m.key, 0]));
        const expenseByMonth = Object.fromEntries(months.map((m) => [m.key, 0]));
        (contributions || []).forEach((c) => {
          const k = monthKey(c.contribution_date);
          if (k in contribByMonth) contribByMonth[k] += Number(c.amount);
        });
        (expenses || []).forEach((e) => {
          const k = monthKey(e.expense_date);
          if (k in expenseByMonth) expenseByMonth[k] += Number(e.amount);
        });

        const memberIdToProfile = Object.fromEntries((members || []).map((m) => [m.id, m.profile_id]));
        const memberTotals = {};
        (contributions || []).forEach((c) => {
          const pid = memberIdToProfile[c.member_id];
          if (!pid) return;
          memberTotals[pid] = (memberTotals[pid] || 0) + Number(c.amount);
        });

        if (mounted) {
          setState({
            loading: false,
            error: '',
            data: {
              profile,
              family,
              members: allProfiles || [],
              memberTotals,
              totalContributions,
              totalExpenses,
              balance,
              months,
              contribSeries: months.map((m) => contribByMonth[m.key]),
              expenseSeries: months.map((m) => expenseByMonth[m.key]),
              activity: activity || [],
            },
          });
        }
      } catch (err) {
        if (mounted) setState({ loading: false, error: toSafeMessage(err), data: null });
      }
    }

    load();

    const channel = supabase
      .channel('dashboard-v2-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => load())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const [showBalance, setShowBalance] = useState(true);
  const data = state.data;

  const balanceDelta = useMemo(() => {
    if (!data || !data.contribSeries) return 0;
    const prevSeries = data.contribSeries.slice(0, -1).reduce((s, v) => s + v, 0) - data.expenseSeries.slice(0, -1).reduce((s, v) => s + v, 0);
    if (!prevSeries) return 0;
    return Math.round(((data.balance - prevSeries) / Math.abs(prevSeries)) * 100);
  }, [data]);

  if (state.loading) {
    return (
      <AppShell>
        <InlineLoading label="Chargement du tableau de bord…" />
      </AppShell>
    );
  }
  if (state.error) {
    return (
      <AppShell>
        <InlineError message={state.error} />
      </AppShell>
    );
  }
  if (data?.noFamily) {
    return (
      <AppShell>
        <InlineError message="Aucune famille associée à ce compte. Rejoignez ou créez une famille pour continuer." />
      </AppShell>
    );
  }

  const firstName = (data.profile.full_name || '').split(' ')[0] || 'là';

  return (
    <AppShell>
      <Styles />
      <div className="db-wrap">
        <section className="db-hero">
          <div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .8 }}>🌱</div>
            <h1>Bonjour, {data.profile.full_name || firstName}</h1>
            <p>Voici un aperçu de la situation financière de votre famille</p>
            <div className="db-hero-badge">
              👪 {data.family?.name || 'Votre famille'}
            </div>
          </div>
          <div className="db-hero-balance">
            <button className="db-hero-balance-label" onClick={() => setShowBalance((v) => !v)}>
              Solde familial {showBalance ? '🙈' : '👁'}
            </button>
            <div className="db-hero-balance-value">{showBalance ? fmt(data.balance) : '••••••'}</div>
            {balanceDelta !== 0 && (
              <div className="db-hero-balance-delta">{balanceDelta > 0 ? '↑' : '↓'} {Math.abs(balanceDelta)}% vs mois dernier</div>
            )}
          </div>
        </section>

        <section className="db-kpis">
          <div className="db-kpi">
            <div className="db-kpi-icon" style={{ background: 'rgba(30,122,76,.12)' }}>💰</div>
            <p className="db-kpi-label">Total des cotisations</p>
            <p className="db-kpi-value">{fmt(data.totalContributions)}</p>
            <MiniBars values={data.contribSeries} color="#1E7A4C" />
            <Link to="/contributions" className="db-kpi-link" style={{ color: '#1E7A4C' }}>Voir les cotisations →</Link>
          </div>

          <div className="db-kpi">
            <div className="db-kpi-icon" style={{ background: 'rgba(192,57,43,.12)' }}>🧾</div>
            <p className="db-kpi-label">Total des dépenses</p>
            <p className="db-kpi-value">{fmt(data.totalExpenses)}</p>
            <MiniBars values={data.expenseSeries} color="#C0392B" />
            <Link to="/expenses" className="db-kpi-link" style={{ color: '#C0392B' }}>Voir les dépenses →</Link>
          </div>

          <div className="db-kpi">
            <div className="db-kpi-icon" style={{ background: 'rgba(45,110,214,.12)' }}>👛</div>
            <p className="db-kpi-label">Solde disponible</p>
            <p className="db-kpi-value">{fmt(data.balance)}</p>
            <MiniBars values={data.months.map((_, i) => data.contribSeries[i] - data.expenseSeries[i])} color="#2D6ED6" />
            <Link to="/activity" className="db-kpi-link" style={{ color: '#2D6ED6' }}>Voir le détail →</Link>
          </div>

          <div className="db-kpi">
            <div className="db-kpi-icon" style={{ background: 'rgba(124,77,255,.12)' }}>👥</div>
            <p className="db-kpi-label">Membres actifs</p>
            <p className="db-kpi-value">{data.members.filter((m) => m.is_active !== false).length}</p>
            <MiniBars values={[1, 2, 2, 3, data.members.length, data.members.length]} color="#7C4DFF" />
            <Link to="/members" className="db-kpi-link" style={{ color: '#7C4DFF' }}>Voir les membres →</Link>
          </div>
        </section>

        <section className="db-main-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="db-panel">
              <div className="db-panel-head">
                <h2 className="db-panel-title">📈 Évolution des finances</h2>
              </div>
              <div className="db-legend">
                <span><i className="db-dot" style={{ background: '#1E7A4C' }} /> Cotisations</span>
                <span><i className="db-dot" style={{ background: '#C0392B' }} /> Dépenses</span>
              </div>
              <LineChart months={data.months} contribSeries={data.contribSeries} expenseSeries={data.expenseSeries} />
            </div>

            <div className="db-banner">
              <p>🌱 « La solidarité familiale est la clé de notre réussite. »</p>
              <Link to="/activity">Voir l'historique →</Link>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="db-panel">
              <div className="db-panel-head">
                <h2 className="db-panel-title">⏱ Activité récente</h2>
                <Link to="/activity" className="db-panel-link" style={{ color: '#1E7A4C' }}>Voir tout</Link>
              </div>
              {data.activity.length === 0 ? (
                <p style={{ fontSize: 13, color: '#8b9187' }}>Aucune activité pour l'instant.</p>
              ) : (
                data.activity.map((item) => {
                  const isExpense = item.action === 'expense_added';
                  const amount = item.details?.amount;
                  return (
                    <div key={item.id} className="db-activity-item">
                      <div className="db-activity-icon" style={{ background: isExpense ? 'rgba(192,57,43,.12)' : 'rgba(30,122,76,.12)', color: isExpense ? '#C0392B' : '#1E7A4C' }}>
                        {isExpense ? '↘' : '↗'}
                      </div>
                      <div>
                        <p className="db-activity-text">{translateAction(item.action)}</p>
                        <p className="db-activity-sub">
                          {item.actor?.full_name ? `Par ${item.actor.full_name} · ` : ''}
                          {new Date(item.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                      {amount != null && (
                        <span className="db-activity-amount" style={{ color: isExpense ? '#C0392B' : '#1E7A4C' }}>{fmt(amount)}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="db-panel">
              <div className="db-panel-head">
                <h2 className="db-panel-title">👪 Membres de la famille</h2>
                <Link to="/members" className="db-panel-link" style={{ color: '#1E7A4C' }}>Voir tout</Link>
              </div>
              {data.members.slice(0, 5).map((m) => {
                const initials = (m.full_name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <Link key={m.id} to="/members" className="db-member-item">
                    <div className="db-member-avatar">{initials}</div>
                    <div>
                      <p className="db-member-name">{m.full_name}</p>
                      <p className="db-member-role">{m.role === 'ADMIN' ? 'Administrateur' : 'Membre'}</p>
                    </div>
                    <span className="db-badge-active">{m.is_active === false ? 'Inactif' : 'Actif'}</span>
                  </Link>
                );
              })}
            </div>

            <div className="db-panel">
              <div className="db-panel-head">
                <h2 className="db-panel-title">⚡ Raccourcis</h2>
              </div>
              <div className="db-shortcuts">
                <Link to="/contributions" className="db-shortcut" style={{ background: 'rgba(30,122,76,.1)', color: '#1E7A4C' }} onClick={() => navigate('/contributions')}>
                  <span className="db-shortcut-icon" style={{ background: '#1E7A4C', color: '#fff' }}>+</span>
                  Ajouter une cotisation
                </Link>
                <Link to="/expenses" className="db-shortcut" style={{ background: 'rgba(192,57,43,.1)', color: '#C0392B' }}>
                  <span className="db-shortcut-icon" style={{ background: '#C0392B', color: '#fff' }}>🧾</span>
                  Enregistrer une dépense
                </Link>
                <Link to="/activity" className="db-shortcut" style={{ background: 'rgba(45,110,214,.1)', color: '#2D6ED6' }}>
                  <span className="db-shortcut-icon" style={{ background: '#2D6ED6', color: '#fff' }}>📊</span>
                  Voir l'activité
                </Link>
                <Link to="/members" className="db-shortcut" style={{ background: 'rgba(124,77,255,.1)', color: '#7C4DFF' }}>
                  <span className="db-shortcut-icon" style={{ background: '#7C4DFF', color: '#fff' }}>👥</span>
                  Gérer les membres
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="db-footer">
          <span>🟢 Connecté à Supabase &nbsp;|&nbsp; ⚡ Temps réel activé</span>
          <span>♡ La Caisse — Gestion Familiale</span>
        </div>
      </div>
    </AppShell>
  );
}
