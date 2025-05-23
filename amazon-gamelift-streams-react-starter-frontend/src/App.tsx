import StreamComponent from './StreamComponent';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';

Amplify.configure({
    Auth: {
        Cognito: {
            // example: 'us-west-2_CmhpQV4GR'
            userPoolId: '<CHANGE-ME>',
            // example: '5b9h9bmmmva3ig1trmq5n90orm'
            userPoolClientId: '<CHANGE-ME>'
        }
    },
    API: {
        REST: {
            'demo-api': {
                // example: 'https://2ki03xizx7.execute-api.us-west-2.amazonaws.com/prod'
                // ensure the endpoint has no trailing slash '/' at the end
                endpoint: '<CHANGE-ME>'
            }
        }
    }
});


function App() {
    return (
        <Authenticator hideSignUp={true} loginMechanisms={['email']}>
            {({ signOut, user }) => (
                <StreamComponent signOut={signOut} user={user}></StreamComponent>
            )}
        </Authenticator>
    );
}

export default App;
