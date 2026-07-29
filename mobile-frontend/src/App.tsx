import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import StreamView from './StreamView';

// Configure Amplify -- same backend as desktop frontend
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: '<CHANGE-ME>',
      userPoolClientId: '<CHANGE-ME>',
    }
  },
  API: {
    REST: {
      GameLiftStreamsAPI: {
        endpoint: '<CHANGE-ME>',
        region: '<CHANGE-ME>'
      }
    }
  }
});

function App() {
  return (
    <Authenticator hideSignUp={true} loginMechanisms={['email']}>
      {({ signOut, user }) => (
        <StreamView signOut={signOut!} user={user!} />
      )}
    </Authenticator>
  );
}

export default App;
