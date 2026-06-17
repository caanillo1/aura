import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { F, FS, LH } from '../design/typography';
import { N, statusColor, STATUS_LABEL } from '../design/colors';
import { SectionTitle } from './SectionTitle';

interface Props {
  os: any;
  pc: string;
  sc: string;
  onPc: string;
  sectionNum: string;
}

const fmt = (s?: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

function InfoCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 90, padding: '10 12', backgroundColor: N.white,
      borderWidth: 0.5, borderColor: N.gray200, borderRadius: 6,
      borderTopWidth: 3, borderTopColor: accent ?? N.gray400 }}>
      <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
        letterSpacing: 0.8, color: N.gray400, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 9.5, fontFamily: F.bold, color: N.gray900, lineHeight: LH.tight }}>
        {value}
      </Text>
      {sub ? <Text style={{ fontSize: FS.small, color: N.gray500, marginTop: 3 }}>{sub}</Text> : null}
    </View>
  );
}

export function ServiceOrderSection({ os, pc, sc, onPc, sectionNum }: Props) {
  const sc_ = statusColor(os.status);
  return (
    <View style={{ marginBottom: 22 }}>
      <SectionTitle n={sectionNum} text="Datos de la Orden de Servicio" pc={pc} onPc={onPc} />

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <InfoCard label="No. Orden"    value={os.osNumber} accent={pc} />
        <InfoCard label="Cliente"      value={os.client?.businessName ?? '—'}
          sub={os.client?.nit ? `NIT: ${os.client.nit}` : undefined} accent={pc} />
        <InfoCard label="Servicio"     value={os.product ?? '—'} accent={pc} />
        <InfoCard label="Estado"       value={STATUS_LABEL[os.status] ?? os.status}
          accent={sc_.text} />
        <InfoCard label="Inicio"       value={fmt(os.startDate)} accent={pc} />
        <InfoCard label="Fin"          value={fmt(os.endDate)}   accent={pc} />
        {os.durationDays ? <InfoCard label="Duracion" value={`${os.durationDays} dias`} accent={pc} /> : null}
        {os.ticketRubi   ? <InfoCard label="Ticket"   value={os.ticketRubi} accent={sc} /> : null}
      </View>

      {(os.scope || os.observations) ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {os.scope ? (
            <View style={{ flex: 1, padding: '12 14', backgroundColor: N.gray50,
              borderWidth: 0.5, borderColor: N.gray200, borderRadius: 6,
              borderLeftWidth: 3, borderLeftColor: pc }}>
              <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
                letterSpacing: 0.8, color: N.gray400, marginBottom: 5 }}>Alcance</Text>
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>
                {os.scope}
              </Text>
            </View>
          ) : null}
          {os.observations ? (
            <View style={{ flex: 1, padding: '12 14', backgroundColor: N.gray50,
              borderWidth: 0.5, borderColor: N.gray200, borderRadius: 6,
              borderLeftWidth: 3, borderLeftColor: sc }}>
              <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
                letterSpacing: 0.8, color: N.gray400, marginBottom: 5 }}>Observaciones</Text>
              <Text style={{ fontSize: FS.body, color: N.gray700, lineHeight: LH.relaxed }}>
                {os.observations}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
