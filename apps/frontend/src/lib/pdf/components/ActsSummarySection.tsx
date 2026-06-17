import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { F, FS } from '../design/typography';
import { N, statusColor, STATUS_LABEL, TIPO_LABEL, TIPO_SHORT, alpha } from '../design/colors';
import { SectionTitle } from './SectionTitle';
import { Table, TR, TC } from './Table';
import { W_ACTAS_SUMMARY } from '../design/tableWidths';

interface Props {
  actas: any[];
  pc: string;
  onPc: string;
  sectionNum: string;
}

const W = W_ACTAS_SUMMARY;

const fmt = (s?: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

export function ActsSummarySection({ actas, pc, onPc, sectionNum }: Props) {
  if (actas.length === 0) return null;
  return (
    <View style={{ marginBottom: 22 }}>
      <SectionTitle n={sectionNum} text="Resumen de Actas" pc={pc} onPc={onPc} />
      <Table>
        <TR isHeader bg={pc}>
          <TC w={W.tipo}   isHeader>Tipo de Acta</TC>
          <TC w={W.numero} isHeader center>Nro.</TC>
          <TC w={W.fecha}  isHeader>Fecha</TC>
          <TC w={W.ciudad} isHeader>Ciudad</TC>
          <TC w={W.modulo} isHeader>Módulo</TC>
          <TC w={W.estado} isHeader>Estado</TC>
          <TC w={W.firmas} isHeader center>Firmas</TC>
        </TR>
        {actas.map((a: any, i) => {
          const sc_   = statusColor(a.status);
          const total = (a.signatures ?? []).length;
          const signed= (a.signatures ?? []).filter((s: any) => s.signedAt).length;
          return (
            <TR key={a.id} isOdd={i % 2 !== 0}>
              <TC w={W.tipo} bold>{TIPO_SHORT[a.actaType] ?? a.actaType}</TC>
              <TC w={W.numero} center>{a.actaNumber ?? '—'}</TC>
              <TC w={W.fecha}>{fmt(a.visitDate ?? a.createdAt)}</TC>
              <TC w={W.ciudad}>{a.city ?? '—'}</TC>
              <TC w={W.modulo}>{a.module ?? '—'}</TC>
              {/* Status cell */}
              <View style={{ width: W.estado, paddingVertical: 4, paddingHorizontal: 6 }}>
                <View style={{ paddingVertical: 2, paddingHorizontal: 5, borderRadius: 3,
                  backgroundColor: sc_.bg, borderWidth: 0.5, borderColor: sc_.border }}>
                  <Text style={{ fontSize: FS.caption + 0.5, fontFamily: F.bold, color: sc_.text }}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </Text>
                </View>
              </View>
              <TC w={W.firmas} center
                color={signed === total && total > 0 ? '#065f46' : '#92400e'}>
                {`${signed}/${total}`}
              </TC>
            </TR>
          );
        })}
      </Table>
    </View>
  );
}
