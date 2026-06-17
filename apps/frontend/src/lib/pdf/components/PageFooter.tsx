import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { F, FS } from '../design/typography';
import { N } from '../design/colors';

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
    <View fixed style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 40, flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 36, paddingBottom: 6,
      borderTopWidth: 0.5, borderTopColor: N.gray200,
      backgroundColor: N.white,
    }}>
      {/* Left: company · report */}
      <Text style={{ flex: 1, fontSize: FS.label, color: N.gray400, fontFamily: F.regular }}>
        {nom}  ·  {reportTitle}  ·  Documento Confidencial  ·  Generado: {date}
      </Text>
      {/* Right: OS · page x of y */}
      <Text
        style={{ fontSize: FS.label, color: N.gray400, fontFamily: F.regular }}
        render={({ pageNumber, totalPages }) =>
          `OS: ${os?.osNumber ?? ''}  ·  Página ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  );
}
