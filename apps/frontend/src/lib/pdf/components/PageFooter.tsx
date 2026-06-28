import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { F, FS } from '../design/typography';
import { N, alpha } from '../design/colors';

interface Props {
  company: any;
  os: any;
  reportTitle: string;
  generatedAt: string;
}

export function PageFooter({ company, os, reportTitle, generatedAt }: Props) {
  const nom = company?.commercialName ?? company?.name ?? '';
  const date = new Date(generatedAt).toLocaleDateString('es-CO', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <View fixed style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'column' }}>
      {/* Top hairline */}
      <View style={{ height: 0.5, backgroundColor: N.gray150, marginHorizontal: 36 }} />

      {/* Footer row */}
      <View style={{
        height: 36, flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 36, backgroundColor: N.white,
      }}>
        {/* Left: company · confidential */}
        <Text style={{ flex: 1, fontSize: 6.5, color: N.gray400 }}>
          {nom}  ·  Documento Confidencial  ·  {date}
        </Text>

        {/* Center: product / OS */}
        <Text style={{ fontSize: 6.5, color: N.gray400 }}>
          {os?.product ?? os?.osNumber ?? ''}
        </Text>

        {/* Right: page counter */}
        <Text
          style={{ width: 100, textAlign: 'right', fontSize: 7, fontFamily: F.bold, color: N.gray600 }}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`}
        />
      </View>
    </View>
  );
}
