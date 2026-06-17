import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { F, FS, LH } from '../design/typography';
import { N, noteColor } from '../design/colors';
import { SectionTitle } from './SectionTitle';

interface Props {
  notes: any[];
  pc: string;
  onPc: string;
  sectionNum: string;
}

const LEVEL_LABEL: Record<string, string> = {
  critica: 'CRITICA', alta: 'ALTA', media: 'MEDIA', baja: 'BAJA',
};
const SUBTYPE_LABEL: Record<string, string> = {
  proximos_logros: 'Próximos Logros',
  riesgo_critico:  'Riesgo Crítico',
};

export function NotesSection({ notes, pc, onPc, sectionNum }: Props) {
  if (notes.length === 0) return null;
  return (
    <View style={{ marginBottom: 22 }}>
      <SectionTitle n={sectionNum} text="Notas y Alertas del Proyecto" pc={pc} onPc={onPc} />
      <View style={{ gap: 6 }}>
        {notes.map((note: any) => {
          const col = noteColor(note.noteLevel);
          return (
            <View key={note.id} wrap={false} style={{
              flexDirection: 'row', gap: 10,
              padding: '10 14', borderRadius: 6,
              backgroundColor: col.bg,
              borderWidth: 0.5, borderColor: col.border,
              borderLeftWidth: 4, borderLeftColor: col.text,
            }}>
              {/* Left badges column */}
              <View style={{ width: 64, gap: 4, paddingTop: 1, flexShrink: 0 }}>
                {/* Level badge */}
                <View style={{ paddingVertical: 2, paddingHorizontal: 5,
                  backgroundColor: col.text, borderRadius: 3 }}>
                  <Text style={{ fontSize: FS.caption, fontFamily: F.bold,
                    color: N.white, textAlign: 'center' }}>
                    {LEVEL_LABEL[note.noteLevel] ?? note.noteLevel}
                  </Text>
                </View>
                {/* Subtype badge */}
                {note.noteSubtype ? (
                  <View style={{ paddingVertical: 2, paddingHorizontal: 5,
                    backgroundColor: col.bg, borderRadius: 3,
                    borderWidth: 0.5, borderColor: col.border }}>
                    <Text style={{ fontSize: FS.caption - 0.5, fontFamily: F.bold,
                      color: col.text, textAlign: 'center' }}>
                      {SUBTYPE_LABEL[note.noteSubtype] ?? note.noteSubtype}
                    </Text>
                  </View>
                ) : null}
                {/* Resolved badge */}
                {note.resolved ? (
                  <View style={{ paddingVertical: 2, paddingHorizontal: 4,
                    backgroundColor: '#d1fae5', borderRadius: 3 }}>
                    <Text style={{ fontSize: FS.caption - 0.5, fontFamily: F.bold,
                      color: '#065f46', textAlign: 'center' }}>
                      RESUELTA
                    </Text>
                  </View>
                ) : null}
              </View>
              {/* Content */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FS.body, fontFamily: F.bold,
                  color: col.text, marginBottom: 3 }}>
                  {note.title}
                </Text>
                {note.description ? (
                  <Text style={{ fontSize: FS.small, color: col.text,
                    lineHeight: LH.relaxed, opacity: 0.85 }}>
                    {note.description}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
