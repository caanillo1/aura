import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { F, FS } from '../design/typography';
import { N, alpha } from '../design/colors';
import { SectionTitle } from './SectionTitle';

interface Props {
  os: any;
  pc: string;
  sc: string;
  onPc: string;
  sectionNum: string;
}

// Long strings without spaces (emails, URLs) don't wrap in react-pdf — truncate them
const truncate = (s: string, n = 28) => (!s || s.length <= n) ? s : s.slice(0, n - 1) + '…';

function Avatar({ name, pc }: { name: string; pc: string }) {
  const pts   = name.trim().split(' ');
  const inits = ((pts[0]?.[0] ?? '') + (pts[1]?.[0] ?? '')).toUpperCase();
  return (
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: alpha(pc, 0.12),
      alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Text style={{ fontSize: 11, fontFamily: F.bold, color: pc }}>{inits}</Text>
    </View>
  );
}

export function ProjectTeamSection({ os, pc, sc, onPc, sectionNum }: Props) {
  const rows = [
    os.clinicalLeader  ? { rol: 'Lider Asistencial',  p: os.clinicalLeader  } : null,
    os.financialLeader ? { rol: 'Lider Financiero',   p: os.financialLeader } : null,
    os.clientLeader    ? { rol: 'Lider del Cliente',  p: os.clientLeader    } : null,
    ...(os.implementers ?? []).map((imp: any) => ({
      rol: `Implementador${imp.role && imp.role !== 'apoyo' ? ` (${imp.role})` : ''}`,
      p: imp.user,
    })),
  ].filter(Boolean) as { rol: string; p: any }[];

  return (
    <View style={{ marginBottom: 22 }}>
      <SectionTitle n={sectionNum} text="Equipo del Proyecto" pc={pc} onPc={onPc} />
      {rows.length === 0 ? (
        <View style={{ padding: 18, backgroundColor: N.gray50, borderRadius: 7,
          borderWidth: 0.5, borderColor: N.gray200, alignItems: 'center' }}>
          <Text style={{ fontSize: FS.body, color: N.gray400 }}>Sin personal asignado</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {rows.map(({ rol, p }, i) => (
            <View key={i} wrap={false} style={{ flex: 1, minWidth: 160, maxWidth: '48%',
              flexDirection: 'row', gap: 8,
              alignItems: 'flex-start', padding: '10 12', borderWidth: 0.5, borderColor: N.gray200,
              borderRadius: 8, backgroundColor: N.gray50, overflow: 'hidden',
              borderTopWidth: 2.5, borderTopColor: i % 2 === 0 ? pc : sc }}>
              <Avatar name={`${p.firstName} ${p.lastName}`} pc={pc} />
              <View style={{ flex: 1, overflow: 'hidden' }}>
                <Text style={{ fontSize: 9, fontFamily: F.bold, color: N.gray900 }}>
                  {p.firstName} {p.lastName}
                </Text>
                <Text style={{ fontSize: FS.label + 0.5, fontFamily: F.bold,
                  textTransform: 'uppercase', letterSpacing: 0.5, color: pc, marginTop: 2 }}>
                  {rol}
                </Text>
                {p.jobTitle && (
                  <Text style={{ fontSize: FS.small, color: N.gray500, marginTop: 2 }}>
                    {truncate(p.jobTitle, 32)}
                  </Text>
                )}
                {p.email && (
                  <Text style={{ fontSize: FS.caption, color: N.gray400, marginTop: 2 }}>
                    {truncate(p.email, 30)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
