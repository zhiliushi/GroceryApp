import React from 'react';
import {StyleSheet} from 'react-native';
import {Button as PaperButton} from 'react-native-paper';
import type {Props as PaperButtonProps} from 'react-native-paper/lib/typescript/components/Button/Button';
import {useAppTheme} from '../../hooks/useAppTheme';

interface ButtonProps extends Omit<PaperButtonProps, 'children'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export default function Button({
  title,
  variant = 'primary',
  style,
  ...props
}: ButtonProps): React.JSX.Element {
  const {colors} = useAppTheme();
  const mode = variant === 'secondary' ? 'outlined' : 'contained';
  const color = variant === 'danger' ? colors.danger : undefined;

  return (
    <PaperButton
      mode={mode}
      buttonColor={variant === 'danger' ? undefined : color}
      textColor={variant === 'danger' ? colors.danger : undefined}
      style={[styles.button, style]}
      {...props}>
      {title}
    </PaperButton>
  );
}

const styles = StyleSheet.create({
  button: {borderRadius: 8},
});
