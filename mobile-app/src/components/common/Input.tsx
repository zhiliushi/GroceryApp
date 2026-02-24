import React from 'react';
import {StyleSheet} from 'react-native';
import {TextInput} from 'react-native-paper';
import type {TextInputProps} from 'react-native-paper';

interface InputProps extends Omit<TextInputProps, 'mode'> {
  errorText?: string;
}

export default function Input({
  style,
  errorText,
  ...props
}: InputProps): React.JSX.Element {
  return (
    <TextInput
      mode="outlined"
      error={!!errorText}
      style={[styles.input, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {marginBottom: 4},
});
