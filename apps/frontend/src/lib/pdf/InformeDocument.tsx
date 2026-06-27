import React from 'react';
import { Document, Page, Font } from '@react-pdf/renderer';
import { F } from './design/typography';
import { textOn } from './design/colors';
import { PAGE } from './design/spacing';

// ── Components ────────────────────────────────────────────────────────────────
import { CoverPage }              from './components/CoverPage';
import { PageHeader }             from './components/PageHeader';
import { PageFooter }             from './components/PageFooter';
import { ProjectSummarySection }  from './components/ProjectSummarySection';
import { ServiceOrderSection }    from './components/ServiceOrderSection';
import { ProjectTeamSection }     from './components/ProjectTeamSection';
import { NotesSection }           from './components/NotesSection';
import { ProgressSection }        from './components/ProgressSection';
import { ActivitiesTable }        from './components/ActivitiesTable';
import { ActsSummarySection }     from './components/ActsSummarySection';
import { TrainingSummarySection } from './components/TrainingSummarySection';
import { ActAttachmentPage }      from './components/ActAttachmentPage';

// ── Disable mid-word hyphenation globally ─────────────────────────────────────
Font.registerHyphenationCallback((word: string) => [word]);

// ── Public data interface ─────────────────────────────────────────────────────
export interface InformeData {
  company: {
    id?: string;
    name?: string;
    commercialName?: string;
    nit?: string;
    city?: string;
    phone?: string;
    email?: string;
    website?: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoData?: string;
  };
  os: {
    id?: string;
    osNumber?: string;
    product?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    durationDays?: number;
    scope?: string;
    observations?: string;
    ticketRubi?: string;
    client?: { id?: string; businessName?: string; nit?: string };
    clinicalLeader?: any;
    financialLeader?: any;
    clientLeader?: any;
    implementers?: any[];
    projectTasks?: any[];
    [k: string]: any;
  };
  project?: any;
  actas: any[];
  notes: any[];
  requerimientos?: any[];
  personalCapacitado: any[];
  personalEnProceso: any[];
  personalPendiente?: any[];
  generatedAt: string;
}

interface Props {
  data: InformeData;
  includeActas?: boolean;
}

// ── Brand helpers ─────────────────────────────────────────────────────────────
const DEFAULT_PC = '#1E3A5F';
const DEFAULT_SC = '#2563EB';

function deriveBrand(company: InformeData['company']) {
  const pc   = company.primaryColor   ?? DEFAULT_PC;
  const sc   = company.secondaryColor ?? DEFAULT_SC;
  const onPc = textOn(pc);
  return { pc, sc, onPc };
}

function deriveActivityStats(tasks: any[]) {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.status === 'completado').length;
  const inProg  = tasks.filter(t => ['en_progreso', 'en_curso', 'activo'].includes(t.status)).length;
  const blocked = tasks.filter(t => t.status === 'bloqueado').length;
  const pend    = total - done - inProg - blocked;
  const pct     = total ? Math.round((done / total) * 100) : 0;
  return { total, done, inProg, blocked, pend, pct };
}

// ── Document ──────────────────────────────────────────────────────────────────
export function InformeDocument({ data, includeActas = false }: Props) {
  const { company, os, actas, notes, personalCapacitado, personalEnProceso,
          personalPendiente, project, generatedAt } = data;

  const { pc, sc, onPc } = deriveBrand(company);
  const tasks             = os.projectTasks ?? [];
  const { total: totalActs, done: doneActs, inProg: inProgActs,
          blocked: blockedActs, pend: pendActs, pct: countPct } = deriveActivityStats(tasks);
  const progressPct = project?.progressPercent != null
    ? Math.round(Number(project.progressPercent))
    : countPct;

  // Avance por tipo de módulo
  const _byTipo: Record<string, number[]> = {};
  for (const m of (project?.modules ?? [])) {
    if (!m.tipo) continue;
    (_byTipo[m.tipo] = _byTipo[m.tipo] ?? []).push(Number(m.progressPercent) || 0);
  }
  const _avg = (arr?: number[]) => arr?.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null;
  const tipoProgress = {
    asistencial: _avg(_byTipo['asistencial']),
    financiero:  _avg(_byTipo['financiero']),
    mixto:       _avg(_byTipo['mixto']),
  };

  const reportTitle = includeActas ? 'Informe Ejecutivo con Actas' : 'Informe Ejecutivo';

  return (
    <Document
      title={`${reportTitle} - OS: ${os.osNumber}`}
      author={company.commercialName ?? company.name ?? 'AURA'}
      subject={`Orden de Servicio ${os.osNumber}`}
    >
      {/* ── Cover ── */}
      <CoverPage
        company={company} os={os} actas={actas} notes={notes}
        personalCapacitado={personalCapacitado} personalEnProceso={personalEnProceso}
        project={project} generatedAt={generatedAt} reportTitle={reportTitle}
        pc={pc} sc={sc} onPc={onPc}
        progressPct={progressPct} totalActs={totalActs} doneActs={doneActs}
        inProgActs={inProgActs} blockedActs={blockedActs} pendActs={pendActs}
      />

      {/* ── Body pages ── */}
      <Page
        size="A4"
        style={{
          fontFamily:        F.regular,
          paddingTop:        PAGE.paddingTop,
          paddingBottom:     PAGE.paddingBottom,
          paddingHorizontal: PAGE.paddingH,
        }}
      >
        <PageHeader company={company} os={os} reportTitle={reportTitle} pc={pc} />
        <PageFooter company={company} os={os} reportTitle={reportTitle} generatedAt={generatedAt} />

        {/* 1 — Executive summary */}
        <ProjectSummarySection
          pc={pc} onPc={onPc} sectionNum="1"
          progressPct={progressPct} totalActs={totalActs} doneActs={doneActs}
          inProgActs={inProgActs} blockedActs={blockedActs} pendActs={pendActs}
          actas={actas} personalCapacitado={personalCapacitado}
          personalEnProceso={personalEnProceso} os={os}
          tipoProgress={tipoProgress}
        />

        {/* 2 — Service order */}
        <ServiceOrderSection os={os} pc={pc} sc={sc} onPc={onPc} sectionNum="2" />

        {/* 3 — Team */}
        <ProjectTeamSection os={os} pc={pc} sc={sc} onPc={onPc} sectionNum="3" />

        {/* 4 — Notes */}
        {notes.length > 0 && (
          <NotesSection notes={notes} pc={pc} onPc={onPc} sectionNum="4" />
        )}

        {/* 5 — Progress by module */}
        {tasks.length > 0 && (
          <ProgressSection os={os} pc={pc} sc={sc} onPc={onPc} sectionNum="5" />
        )}

        {/* 6 — Activities table */}
        {tasks.length > 0 && (
          <ActivitiesTable os={os} pc={pc} onPc={onPc} sectionNum="6" />
        )}

        {/* 7 — Actas summary */}
        {actas.length > 0 && (
          <ActsSummarySection actas={actas} pc={pc} onPc={onPc} sectionNum="7" />
        )}

        {/* 8 — Training */}
        <TrainingSummarySection
          personalCapacitado={personalCapacitado}
          personalEnProceso={personalEnProceso}
          personalPendiente={personalPendiente}
          pc={pc} onPc={onPc} sectionNum="8"
        />
      </Page>

      {/* ── Acta attachment pages (one per acta) ── */}
      {includeActas && actas.map((acta: any, i) => (
        <ActAttachmentPage
          key={acta.id ?? i}
          acta={acta}
          index={i + 1}
          pc={pc} sc={sc}
          company={company} os={os}
          reportTitle={reportTitle}
          generatedAt={generatedAt}
        />
      ))}
    </Document>
  );
}
