import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './AuthStore';
import { AppStoreProvider } from './AppStore';
import { router } from './router';

export function App() {
  return (
    <AuthProvider>
      <AppStoreProvider>
        <RouterProvider router={router} />
      </AppStoreProvider>
    </AuthProvider>
  );
}
