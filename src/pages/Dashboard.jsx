import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toSafeMessage } from '../utils/errors';
import AppShell from '../components/AppShell';
import { InlineLoading, InlineError, EmptyState } from '../components/StateViews';

function formatAmount(n) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(n);
}

function translateAction(action) {
  const map = {
    family_created: 'a créé la famille',
    contribution_added: 'a ajouté une contribution',
    expense_added: 'a ajouté une dépense',
    member_deactivated: 'a désactivé un membre',
    member_reactivated: 'a réactivé un membre',
    join_request_approved: "a accepté une demande d'adhésion",
    join_request_rejected: "a refusé une demande d'adhésion",
    role_changed: 'a modifié un rôle',
  };
  return map[action] || action;
}

function actionMeta(action) {
  if (action === 'contribution_added') return { icon: '↗', tone: 'green', label: 'Contribution' };
  if (action === 'expense_added') return { icon: '↘', tone: 'orange', label: 'Dépense' };
  if (action?.includes('member')) return { icon: '◉', tone: 'blue', label: 'Membre' };
  if (action?.includes('join_request')) return { icon: '✓', tone: 'purple', label: 'Adhésion' };
  if (action === 'role_changed') return { icon: '◆', tone: 'pink', label: 'Rôle' };
  return { icon: '•', tone: 'neutral', label: 'Activité' };
}

function GlassOrb({ balance }) {
  const positive = balance >= 0;

  return (
    <div className="fh-orb-wrap" aria-hidden="true">
      <div className="fh-orb-shadow" />
      <div className="fh-orb">
        <div className="fh-orb-core">
          <span className="fh-orb-dot" />
        </div>
        <div className="fh-orbit fh-orbit-a" />
        <div className="fh-orbit fh-orbit-b" />
        <div className="fh-orbit fh-orbit-c" />
        <div className="fh-orb-glow" />
      </div>
      <span className={`fh-orb-status ${positive ? 'positive' : 'negative'}`}>
        {positive ? 'Équilibre positif' : 'Solde négatif'}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [state, setState] = useState({
    loading: true,
    error: '',
    data: null,
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [
          { data: contributions, error: e1 },
          { data: expenses, error: e2 },
          { data: members, error: e3 },
          { data: activity, error: e4 },
        ] = await Promise.all([
          supabase.from('contributions').select('amount'),
          supabase.from('expenses').select('amount'),
          supabase.from('members').select('id, status').eq('status', 'active'),
          supabase
            .from('activity_logs')
            .select('id, action, details, created_at, actor:profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(8),
        ]);

        if (e1 || e2 || e3 || e4) throw e1 || e2 || e3 || e4;

        const totalContributions = (contributions || []).reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );
        const totalExpenses = (expenses || []).reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );

        if (mounted) {
          setState({
            loading: false,
            error: '',
            data: {
              totalContributions,
              totalExpenses,
              balance: totalContributions - totalExpenses,
              memberCount: (members || []).length,
              recentActivity: activity || [],
            },
          });
        }
      } catch (err) {
        if (mounted) {
          setState({
            loading: false,
            error: toSafeMessage(err),
            data: null,
          });
        }
      }
    }

    load();

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contributions' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        () => load()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const data = state.data;

  const balanceRatio = useMemo(() => {
    if (!data || data.totalContributions <= 0) return 0;
    return Math.min(100, Math.max(0, (data.balance / data.totalContributions) * 100));
  }, [data]);

  return (
    <AppShell>
      <style>{`
        .fh-dashboard {
          --fh-ink: #18202b;
          --fh-muted: #718092;
          --fh-line: rgba(24, 32, 43, .09);
          --fh-surface: rgba(255,255,255,.78);
          --fh-primary: #7257ff;
          --fh-cyan: #20c7d9;
          --fh-green: #18a875;
          --fh-orange: #f39a4a;
          --fh-pink: #e85b9c;
          color: var(--fh-ink);
          min-height: 100%;
          padding: clamp(8px, 1.5vw, 22px);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .fh-topbar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .fh-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: var(--fh-primary);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .13em;
          text-transform: uppercase;
        }

        .fh-kicker::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--fh-cyan);
          box-shadow: 0 0 0 5px rgba(32,199,217,.10);
        }

        .fh-title {
          margin: 0;
          font-size: clamp(28px, 4vw, 46px);
          line-height: .98;
          letter-spacing: -.055em;
          font-weight: 850;
        }

        .fh-subtitle {
          margin: 10px 0 0;
          color: var(--fh-muted);
          font-size: 14px;
        }

        .fh-live {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 13px;
          border: 1px solid var(--fh-line);
          border-radius: 999px;
          background: rgba(255,255,255,.64);
          box-shadow: 0 10px 30px rgba(28,37,50,.05);
          font-size: 12px;
          font-weight: 750;
          white-space: nowrap;
        }

        .fh-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--fh-green);
          box-shadow: 0 0 0 5px rgba(24,168,117,.10);
          animation: fh-pulse 2s ease-in-out infinite;
        }

        .fh-hero {
          position: relative;
          overflow: hidden;
          min-height: 330px;
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(260px, .65fr);
          align-items: center;
          gap: 20px;
          padding: clamp(24px, 4vw, 42px);
          border: 1px solid rgba(255,255,255,.8);
          border-radius: 32px;
          background:
            radial-gradient(circle at 12% 15%, rgba(32,199,217,.22), transparent 29%),
            radial-gradient(circle at 85% 18%, rgba(232,91,156,.18), transparent 25%),
            linear-gradient(135deg, #18202b 0%, #272345 50%, #172b3a 100%);
          color: white;
          box-shadow: 0 30px 70px rgba(30,36,55,.18);
        }

        .fh-hero::before,
        .fh-hero::after {
          content: "";
          position: absolute;
          width: 220px;
          height: 220px;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 40% 60% 55% 45%;
          pointer-events: none;
        }

        .fh-hero::before {
          right: -90px;
          top: -110px;
          transform: rotate(25deg);
        }

        .fh-hero::after {
          left: 30%;
          bottom: -190px;
          transform: rotate(-20deg);
        }

        .fh-hero-content { position: relative; z-index: 2; }

        .fh-eyebrow {
          margin: 0 0 12px;
          color: rgba(255,255,255,.66);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .fh-balance {
          margin: 0;
          font-size: clamp(38px, 6vw, 68px);
          line-height: .96;
          letter-spacing: -.065em;
          font-weight: 900;
        }

        .fh-balance-label {
          margin: 13px 0 0;
          color: rgba(255,255,255,.72);
          font-size: 14px;
        }

        .fh-progress {
          width: min(520px, 100%);
          height: 7px;
          margin-top: 28px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
        }

        .fh-progress > span {
          display: block;
          height: 100%;
          width: ${balanceRatio}%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--fh-cyan), #8a72ff, var(--fh-pink));
          box-shadow: 0 0 18px rgba(114,87,255,.65);
          transition: width .8s cubic-bezier(.2,.8,.2,1);
        }

        .fh-orb-wrap {
          position: relative;
          min-height: 270px;
          display: grid;
          place-items: center;
          z-index: 2;
        }

        .fh-orb {
          position: relative;
          width: 190px;
          height: 190px;
          transform-style: preserve-3d;
          animation: fh-float 5s ease-in-out infinite;
        }

        .fh-orb-core {
          position: absolute;
          inset: 32px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background:
            radial-gradient(circle at 30% 25%, rgba(255,255,255,.9), rgba(255,255,255,.18) 16%, transparent 30%),
            radial-gradient(circle at 55% 60%, #7160ff, #354d9d 52%, #1c2b46 78%);
          box-shadow:
            inset -20px -25px 35px rgba(0,0,0,.25),
            inset 12px 10px 25px rgba(255,255,255,.22),
            0 0 55px rgba(82,103,255,.38);
        }

        .fh-orb-dot {
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: rgba(255,255,255,.85);
          box-shadow: 0 0 25px white;
        }

        .fh-orbit {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(255,255,255,.42);
          border-radius: 50%;
          transform: rotateX(66deg) rotateZ(18deg);
        }

        .fh-orbit::after {
          content: "";
          position: absolute;
          left: 50%;
          top: -5px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #20c7d9;
          box-shadow: 0 0 16px #20c7d9;
        }

        .fh-orbit-a { transform: rotateX(66deg) rotateZ(18deg); animation: fh-spin 8s linear infinite; }
        .fh-orbit-b { transform: rotateY(67deg) rotateZ(-26deg); animation: fh-spin-reverse 10s linear infinite; }
        .fh-orbit-c { transform: rotateX(70deg) rotateY(25deg) rotateZ(72deg); animation: fh-spin 13s linear infinite; opacity: .55; }

        .fh-orb-glow {
          position: absolute;
          inset: 20px;
          border-radius: 50%;
          background: rgba(86,107,255,.12);
          filter: blur(25px);
          transform: translateZ(-20px);
        }

        .fh-orb-shadow {
          position: absolute;
          bottom: 28px;
          width: 150px;
          height: 25px;
          border-radius: 50%;
          background: rgba(0,0,0,.25);
          filter: blur(13px);
          animation: fh-shadow 5s ease-in-out infinite;
        }

        .fh-orb-status {
          position: absolute;
          bottom: 0;
          padding: 8px 12px;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 999px;
          background: rgba(255,255,255,.08);
          color: rgba(255,255,255,.78);
          font-size: 11px;
          font-weight: 750;
          backdrop-filter: blur(12px);
        }

        .fh-orb-status.positive::before,
        .fh-orb-status.negative::before {
          content: "";
          display: inline-block;
          width: 6px;
          height: 6px;
          margin-right: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .fh-orb-status.positive { color: #76e4bd; }
        .fh-orb-status.negative { color: #ff9b9b; }

        .fh-stat-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 14px;
        }

        .fh-stat {
          position: relative;
          overflow: hidden;
          padding: 22px;
          border: 1px solid var(--fh-line);
          border-radius: 24px;
          background: var(--fh-surface);
          box-shadow: 0 16px 45px rgba(32,40,54,.06);
          backdrop-filter: blur(18px);
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }

        .fh-stat:hover {
          transform: translateY(-4px);
          box-shadow: 0 22px 55px rgba(32,40,54,.10);
          border-color: rgba(114,87,255,.20);
        }

        .fh-stat::after {
          content: "";
          position: absolute;
          width: 110px;
          height: 110px;
          right: -55px;
          top: -55px;
          border-radius: 50%;
          background: var(--fh-stat-glow, rgba(114,87,255,.10));
        }

        .fh-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .fh-stat-icon {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 14px;
          background: var(--fh-icon-bg, rgba(114,87,255,.10));
          color: var(--fh-icon, var(--fh-primary));
          font-weight: 900;
        }

        .fh-stat-label {
          margin: 0;
          color: var(--fh-muted);
          font-size: 12px;
          font-weight: 750;
        }

        .fh-stat-value {
          margin: 18px 0 0;
          font-size: clamp(21px, 2.5vw, 30px);
          font-weight: 850;
          letter-spacing: -.04em;
        }

        .fh-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(280px, .7fr);
          gap: 14px;
          margin-top: 14px;
        }

        .fh-panel {
          border: 1px solid var(--fh-line);
          border-radius: 26px;
          background: var(--fh-surface);
          box-shadow: 0 16px 45px rgba(32,40,54,.055);
          backdrop-filter: blur(18px);
        }

        .fh-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 22px 14px;
        }

        .fh-panel-title {
          margin: 0;
          font-size: 17px;
          letter-spacing: -.02em;
        }

        .fh-panel-caption {
          margin: 5px 0 0;
          color: var(--fh-muted);
          font-size: 12px;
        }

        .fh-activity {
          list-style: none;
          padding: 0 12px 12px;
          margin: 0;
        }

        .fh-activity-item {
          display: grid;
          grid-template-columns: 42px minmax(0,1fr) auto;
          align-items: center;
          gap: 12px;
          padding: 13px 10px;
          border-radius: 18px;
          transition: background .2s ease, transform .2s ease;
        }

        .fh-activity-item:hover {
          background: rgba(114,87,255,.055);
          transform: translateX(3px);
        }

        .fh-avatar {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 850;
        }

        .fh-avatar.green { background: rgba(24,168,117,.12); color: var(--fh-green); }
        .fh-avatar.orange { background: rgba(243,154,74,.13); color: #d87922; }
        .fh-avatar.blue { background: rgba(56,132,214,.12); color: #3884d6; }
        .fh-avatar.purple { background: rgba(114,87,255,.12); color: var(--fh-primary); }
        .fh-avatar.pink { background: rgba(232,91,156,.12); color: var(--fh-pink); }
        .fh-avatar.neutral { background: rgba(24,32,43,.07); color: var(--fh-muted); }

        .fh-activity-main {
          min-width: 0;
        }

        .fh-activity-text {
          margin: 0;
          font-size: 13px;
          line-height: 1.4;
        }

        .fh-activity-text strong { font-weight: 800; }

        .fh-activity-tag {
          display: inline-block;
          margin-left: 7px;
          padding: 3px 7px;
          border-radius: 999px;
          background: rgba(24,32,43,.055);
          color: var(--fh-muted);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .fh-activity-date {
          color: var(--fh-muted);
          font-size: 10px;
          white-space: nowrap;
        }

        .fh-mini {
          padding: 22px;
        }

        .fh-mini-value {
          margin: 8px 0 0;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -.045em;
        }

        .fh-mini-line {
          height: 1px;
          margin: 19px 0;
          background: var(--fh-line);
        }

        .fh-breakdown {
          display: grid;
          gap: 12px;
        }

        .fh-breakdown-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          font-size: 12px;
        }

        .fh-breakdown-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--fh-muted);
        }

        .fh-breakdown-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--fh-dot, var(--fh-primary));
        }

        .fh-breakdown-value { font-weight: 800; }

        .fh-loading {
          padding: 30px 0;
        }

        @keyframes fh-float {
          0%,100% { transform: translateY(0) rotateZ(-1deg); }
          50% { transform: translateY(-10px) rotateZ(2deg); }
        }

        @keyframes fh-shadow {
          0%,100% { transform: scaleX(1); opacity: .6; }
          50% { transform: scaleX(.82); opacity: .35; }
        }

        @keyframes fh-spin {
          to { transform: rotateX(66deg) rotateZ(378deg); }
        }

        @keyframes fh-spin-reverse {
          to { transform: rotateY(67deg) rotateZ(-386deg); }
        }

        @keyframes fh-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: .45; transform: scale(.8); }
        }

        @media (max-width: 900px) {
          .fh-hero { grid-template-columns: 1fr; }
          .fh-orb-wrap { min-height: 230px; }
          .fh-stat-grid { grid-template-columns: 1fr; }
          .fh-main-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 620px) {
          .fh-dashboard { padding: 4px; }
          .fh-topbar { align-items: flex-start; flex-direction: column; }
          .fh-hero { border-radius: 24px; padding: 24px 20px; }
          .fh-orb { width: 155px; height: 155px; }
          .fh-orb-core { inset: 28px; }
          .fh-orb-wrap { min-height: 205px; }
          .fh-panel { border-radius: 22px; }
          .fh-activity-item { grid-template-columns: 38px minmax(0,1fr); }
          .fh-activity-date { grid-column: 2; }
        }

        @media (prefers-reduced-motion: reduce) {
          .fh-dashboard *,
          .fh-dashboard *::before,
          .fh-dashboard *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <div className="fh-dashboard">
        <header className="fh-topbar">
          <div>
            <div className="fh-kicker">Espace familial</div>
            <h1 className="fh-title">Tableau de bord</h1>
            <p className="fh-subtitle">
              Une vue claire et vivante de la caisse de votre famille.
            </p>
          </div>

          <div className="fh-live">
            <span className="fh-live-dot" />
            Données synchronisées
          </div>
        </header>

        {state.loading && (
          <div className="fh-loading">
            <InlineLoading label="Chargement du tableau de bord…" />
          </div>
        )}

        {state.error && <InlineError message={state.error} />}

        {data && (
          <>
            <section className="fh-hero">
              <div className="fh-hero-content">
                <p className="fh-eyebrow">Solde familial</p>
                <p className="fh-balance">{formatAmount(data.balance)}</p>
                <p className="fh-balance-label">
                  Contributions disponibles après les dépenses enregistrées.
                </p>

                <div
                  className="fh-progress"
                  role="progressbar"
                  aria-valuenow={Math.round(balanceRatio)}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-label="Part du solde par rapport aux contributions"
                >
                  <span />
                </div>
              </div>

              <GlassOrb balance={data.balance} />
            </section>

            <section className="fh-stat-grid" aria-label="Indicateurs financiers">
              <article
                className="fh-stat"
                style={{
                  '--fh-icon-bg': 'rgba(24,168,117,.11)',
                  '--fh-icon': '#18a875',
                  '--fh-stat-glow': 'rgba(24,168,117,.08)',
                }}
              >
                <div className="fh-stat-top">
                  <p className="fh-stat-label">Total des contributions</p>
                  <span className="fh-stat-icon">↗</span>
                </div>
                <p className="fh-stat-value">{formatAmount(data.totalContributions)}</p>
              </article>

              <article
                className="fh-stat"
                style={{
                  '--fh-icon-bg': 'rgba(243,154,74,.12)',
                  '--fh-icon': '#d87922',
                  '--fh-stat-glow': 'rgba(243,154,74,.09)',
                }}
              >
                <div className="fh-stat-top">
                  <p className="fh-stat-label">Total des dépenses</p>
                  <span className="fh-stat-icon">↘</span>
                </div>
                <p className="fh-stat-value">{formatAmount(data.totalExpenses)}</p>
              </article>

              <article
                className="fh-stat"
                style={{
                  '--fh-icon-bg': 'rgba(56,132,214,.12)',
                  '--fh-icon': '#3884d6',
                  '--fh-stat-glow': 'rgba(56,132,214,.08)',
                }}
              >
                <div className="fh-stat-top">
                  <p className="fh-stat-label">Membres actifs</p>
                  <span className="fh-stat-icon">◉</span>
                </div>
                <p className="fh-stat-value">{data.memberCount}</p>
              </article>
            </section>

            <section className="fh-main-grid">
              <div className="fh-panel">
                <div className="fh-panel-head">
                  <div>
                    <h2 className="fh-panel-title">Activité récente</h2>
                    <p className="fh-panel-caption">
                      Les dernières actions enregistrées dans votre espace.
                    </p>
                  </div>
                </div>

                {data.recentActivity.length === 0 ? (
                  <div style={{ padding: '0 22px 22px' }}>
                    <EmptyState
                      title="Aucune activité pour l'instant"
                      description="Les actions de la famille apparaîtront ici."
                    />
                  </div>
                ) : (
                  <ul className="fh-activity">
                    {data.recentActivity.map((item) => {
                      const meta = actionMeta(item.action);
                      const actor = item.actor?.full_name || 'Un membre';

                      return (
                        <li key={item.id} className="fh-activity-item">
                          <div className={`fh-avatar ${meta.tone}`}>{meta.icon}</div>

                          <div className="fh-activity-main">
                            <p className="fh-activity-text">
                              <strong>{actor}</strong>{' '}
                              {translateAction(item.action)}
                              <span className="fh-activity-tag">{meta.label}</span>
                            </p>
                          </div>

                          <time
                            className="fh-activity-date"
                            dateTime={item.created_at}
                          >
                            {new Date(item.created_at).toLocaleDateString('fr-FR')}
                          </time>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <aside className="fh-panel fh-mini">
                <p className="fh-stat-label">Vue financière</p>
                <p className="fh-mini-value">{formatAmount(data.balance)}</p>

                <div className="fh-mini-line" />

                <div className="fh-breakdown">
                  <div className="fh-breakdown-row">
                    <span className="fh-breakdown-label">
                      <i
                        className="fh-breakdown-dot"
                        style={{ '--fh-dot': '#18a875' }}
                      />
                      Contributions
                    </span>
                    <span className="fh-breakdown-value">
                      {formatAmount(data.totalContributions)}
                    </span>
                  </div>

                  <div className="fh-breakdown-row">
                    <span className="fh-breakdown-label">
                      <i
                        className="fh-breakdown-dot"
                        style={{ '--fh-dot': '#f39a4a' }}
                      />
                      Dépenses
                    </span>
                    <span className="fh-breakdown-value">
                      {formatAmount(data.totalExpenses)}
                    </span>
                  </div>

                  <div className="fh-breakdown-row">
                    <span className="fh-breakdown-label">
                      <i
                        className="fh-breakdown-dot"
                        style={{ '--fh-dot': '#3884d6' }}
                      />
                      Membres actifs
                    </span>
                    <span className="fh-breakdown-value">
                      {data.memberCount}
                    </span>
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
