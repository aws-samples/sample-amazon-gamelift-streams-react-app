// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import './StreamComponent.css';

interface NavBarProps {
    user: any;
    signOut: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ user, signOut }) => {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            backgroundColor: '#101419',
            height: '110px'
        }}>
            {/* Empty div for left spacing */}
            <div style={{ flex: 1 }} />
            
            {/* Center content with title and logo */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px'
            }}>
                <span style={{
                    color: 'white',
                    fontSize: 'clamp(16px, 2.5vw, 36px)',
                    fontWeight: '500'
                }}>
                    Amazon GameLift Streams
                </span>
                <div className="logo" />
            </div>
            
            {/* Sign out button container */}
            <div style={{ 
                flex: 1,
                display: 'flex',
                justifyContent: 'flex-end',
                marginRight: '10px',
                marginLeft: '20px'
            }}>
                {user && (
                    <button onClick={signOut}>
                        Sign Out
                    </button>
                )}
            </div>
        </div>
    );
};

export default NavBar;
