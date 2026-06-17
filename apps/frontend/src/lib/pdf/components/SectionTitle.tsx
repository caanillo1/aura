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
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginBottom: 10, paddingBottom: 7,
        borderBottomWidth: 1.5, borderBottomColor: alpha(pc, 0.22),
      }}
    >
      {n ? (
        <View style={{
          width: 20, height: 20, borderRadius: 10,
          backgroundColor: pc, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 9, fontFamily: F.bold, color: onPc }}>{n}</Text>
        </View>
      ) : null}
      <Text style={{
        fontSize: FS.h2, fontFamily: F.bold,
        textTransform: 'uppercase', letterSpacing: 0.8, color: N.gray900,
      }}>
        {text}
      </Text>
    </View>
  );
}

export function SubTitle({ text }: { text: string }) {
  return (
    <Text style={{
      fontSize: FS.label + 0.5, fontFamily: F.bold,
      textTransform: 'uppercase', letterSpacing: 0.7, color: N.gray500,
      marginTop: 10, marginBottom: 5, paddingBottom: 3,
      borderBottomWidth: 0.5, borderBottomColor: N.gray100,
    }}>
      {text}
    </Text>
  );
}
