import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { F, FS } from '../design/typography';
import { N, alpha } from '../design/colors';

interface Props {
  n?: string | null;
  text: string;
  pc: string;
  onPc: string;
}

export function SectionTitle({ n, text, pc, onPc }: Props) {
  return (
    <View
      minPresenceAhead={80}
      style={{
        flexDirection: 'row', alignItems: 'stretch',
        marginBottom: 14,
      }}
    >
      {/* Vertical accent bar */}
      <View style={{ width: 3, backgroundColor: pc, borderRadius: 2, marginRight: 10, minHeight: 24 }} />

      {/* Number + label */}
      <View style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingBottom: 9, borderBottomWidth: 0.5, borderBottomColor: N.gray100,
      }}>
        {n != null && (
          <View style={{
            paddingHorizontal: 6, paddingVertical: 3,
            backgroundColor: alpha(pc, 0.09), borderRadius: 4,
          }}>
            <Text style={{ fontSize: 7, fontFamily: F.bold, color: pc }}>{n}</Text>
          </View>
        )}
        <Text style={{
          fontSize: 10, fontFamily: F.bold,
          textTransform: 'uppercase', letterSpacing: 1.2, color: N.gray800,
        }}>
          {text}
        </Text>
      </View>
    </View>
  );
}

export function SubTitle({ text }: { text: string }) {
  return (
    <Text style={{
      fontSize: FS.label + 0.5, fontFamily: F.bold,
      textTransform: 'uppercase', letterSpacing: 0.8, color: N.gray500,
      marginTop: 11, marginBottom: 5, paddingBottom: 3,
      borderBottomWidth: 0.5, borderBottomColor: N.gray100,
    }}>
      {text}
    </Text>
  );
}
