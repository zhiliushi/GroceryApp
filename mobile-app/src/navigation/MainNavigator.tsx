import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Icon} from 'react-native-paper';
import {useAppTheme} from '../hooks/useAppTheme';
import HomeScreen from '../screens/home/HomeScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import InventoryDetailScreen from '../screens/inventory/InventoryDetailScreen';
import BarcodeScannerScreen from '../screens/scanner/BarcodeScannerScreen';
import ShoppingListsScreen from '../screens/lists/ShoppingListsScreen';
import ListDetailScreen from '../screens/lists/ListDetailScreen';
import AddListItemScreen from '../screens/lists/AddListItemScreen';
import EditListItemScreen from '../screens/lists/EditListItemScreen';
import ShoppingCheckoutScreen from '../screens/lists/ShoppingCheckoutScreen';
import ListPickerScreen from '../screens/lists/ListPickerScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import AddInventoryItemScreen from '../screens/inventory/AddInventoryItemScreen';
import RestockScreen from '../screens/inventory/RestockScreen';
import AddMethodScreen from '../screens/common/AddMethodScreen';
import ContextScannerScreen from '../screens/common/ContextScannerScreen';
import PastItemsScreen from '../screens/inventory/PastItemsScreen';

// ---------------------------------------------------------------------------
// Stack navigators for each tab
// ---------------------------------------------------------------------------

const HomeStack = createNativeStackNavigator();
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen name="Home" component={HomeScreen} options={{title: 'Inventory'}} />
      <HomeStack.Screen name="InventoryDetail" component={InventoryDetailScreen} options={{title: 'Item Details'}} />
      <HomeStack.Screen name="Restock" component={RestockScreen} options={{title: 'Restock'}} />
      <HomeStack.Screen name="AddMethod" component={AddMethodScreen} options={{title: 'Add Item'}} />
      <HomeStack.Screen name="ContextScanner" component={ContextScannerScreen} options={{headerShown: false}} />
      <HomeStack.Screen name="AddItem" component={AddInventoryItemScreen} options={{title: 'Add Item'}} />
      <HomeStack.Screen name="PastItems" component={PastItemsScreen} options={{title: 'Past Items'}} />
    </HomeStack.Navigator>
  );
}

const ShoppingStack = createNativeStackNavigator();
function ShoppingStackNavigator() {
  return (
    <ShoppingStack.Navigator>
      <ShoppingStack.Screen name="ShoppingLists" component={ShoppingListsScreen} options={{title: 'Shopping'}} />
      <ShoppingStack.Screen name="ListDetail" component={ListDetailScreen} options={{title: 'List'}} />
      <ShoppingStack.Screen name="AddMethod" component={AddMethodScreen} options={{title: 'Add Items'}} />
      <ShoppingStack.Screen name="ContextScanner" component={ContextScannerScreen} options={{headerShown: false}} />
      <ShoppingStack.Screen name="AddListItem" component={AddListItemScreen} options={{title: 'Add Items'}} />
      <ShoppingStack.Screen name="EditListItem" component={EditListItemScreen} options={{title: 'Edit Item'}} />
      <ShoppingStack.Screen name="ShoppingCheckout" component={ShoppingCheckoutScreen} options={{title: 'Checkout'}} />
      <ShoppingStack.Screen name="AddItem" component={AddInventoryItemScreen} options={{title: 'Add Item'}} />
    </ShoppingStack.Navigator>
  );
}

const ScannerStack = createNativeStackNavigator();
function ScannerStackNavigator() {
  return (
    <ScannerStack.Navigator>
      <ScannerStack.Screen
        name="Scanner"
        component={BarcodeScannerScreen}
        options={{headerShown: false}}
      />
      <ScannerStack.Screen
        name="AddItem"
        component={AddInventoryItemScreen}
        options={{title: 'Add to Inventory'}}
      />
      <ScannerStack.Screen
        name="ListPicker"
        component={ListPickerScreen}
        options={{title: 'Pick a List'}}
      />
      <ScannerStack.Screen
        name="AddListItem"
        component={AddListItemScreen}
        options={{title: 'Add to List'}}
      />
    </ScannerStack.Navigator>
  );
}

const InventoryStack = createNativeStackNavigator();
function InventoryStackNavigator() {
  return (
    <InventoryStack.Navigator>
      <InventoryStack.Screen name="Inventory" component={InventoryScreen} options={{title: 'All Items'}} />
      <InventoryStack.Screen name="InventoryDetail" component={InventoryDetailScreen} options={{title: 'Details'}} />
      <InventoryStack.Screen name="AddMethod" component={AddMethodScreen} options={{title: 'Add Item'}} />
      <InventoryStack.Screen name="ContextScanner" component={ContextScannerScreen} options={{headerShown: false}} />
      <InventoryStack.Screen name="AddItem" component={AddInventoryItemScreen} options={{title: 'Add Item'}} />
      <InventoryStack.Screen name="PastItems" component={PastItemsScreen} options={{title: 'Past Items'}} />
    </InventoryStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Bottom tabs
// ---------------------------------------------------------------------------

const Tab = createBottomTabNavigator();

export default function MainNavigator(): React.JSX.Element {
  const {colors} = useAppTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
      }}>
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({color, size}) => (
            <Icon source="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScannerStackNavigator}
        options={{
          title: 'Scan',
          tabBarIcon: ({color, size}) => (
            <Icon source="barcode-scan" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryStackNavigator}
        options={{
          title: 'Inventory',
          tabBarIcon: ({color, size}) => (
            <Icon source="fridge" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ShoppingTab"
        component={ShoppingStackNavigator}
        options={{
          title: 'Shopping',
          tabBarIcon: ({color, size}) => (
            <Icon source="cart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({color, size}) => (
            <Icon source="cog" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
