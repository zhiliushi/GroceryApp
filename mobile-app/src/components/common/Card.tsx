import React from 'react';
import {StyleSheet} from 'react-native';
import {Card as PaperCard} from 'react-native-paper';
import type {Props as PaperCardProps} from 'react-native-paper/lib/typescript/components/Card/Card';

interface CardProps extends PaperCardProps {
  children: React.ReactNode;
}

export default function Card({
  children,
  style,
  ...props
}: CardProps): React.JSX.Element {
  return (
    <PaperCard style={[styles.card, style]} {...props}>
      {children}
    </PaperCard>
  );
}

const styles = StyleSheet.create({
  card: {marginBottom: 8, borderRadius: 12},
});
