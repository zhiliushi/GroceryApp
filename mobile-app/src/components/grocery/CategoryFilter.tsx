import React from 'react';
import {FlatList, StyleSheet} from 'react-native';
import {Chip} from 'react-native-paper';

interface CategoryItem {
  id: string;
  name: string;
}

interface Props {
  categories: CategoryItem[];
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
}

export default function CategoryFilter({
  categories,
  selected,
  onSelect,
}: Props): React.JSX.Element {
  const data: CategoryItem[] = [{id: '__all', name: 'All'}, ...categories];

  return (
    <FlatList
      horizontal
      data={data}
      keyExtractor={item => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      renderItem={({item}) => {
        const isSelected =
          item.id === '__all' ? selected === null : selected === item.id;
        return (
          <Chip
            selected={isSelected}
            onPress={() =>
              onSelect(item.id === '__all' ? null : item.id)
            }
            style={styles.chip}>
            {item.name}
          </Chip>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {paddingHorizontal: 12, paddingVertical: 8, gap: 6},
  chip: {marginRight: 4},
});
