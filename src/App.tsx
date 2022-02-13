import React, { useEffect, useState } from 'react';
import './App.css';
import 'react-chat-widget/lib/styles.css';
import {
    ApiConnection,
    ConnectionState,
    Account,
    getWeb3Provider,
    Keys,
} from './lib/Web3Provider';
import { log } from './lib/log';
import detectEthereumProvider from '@metamask/detect-provider';
import SignIn, { showSignIn } from './SignIn';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import AccountNameHeader from './AccountNameHeader';
import { getContacts } from './external-apis/BackendAPI';
import ContactList from './ContactList';
import AddContactForm from './AddContactForm';
import { lookupAddress } from './external-apis/InjectedWeb3API';
import { ethers } from 'ethers';
import Chat from './Chat';
import { isWidgetOpened, toggleWidget } from 'react-chat-widget';
import socketIOClient from 'socket.io-client';
import { Envelop } from './lib/Messaging';
import ChatHeader from './ChatHeader';
import Start from './Start';
import SignInHelp from './SignInHelp';
import AddPubKeyView from './AddPubKeyView';
import AddPubKeyHelper from './AddPubKeyHelper';

function App() {
    const [apiConnection, setApiConnection] = useState<ApiConnection>({
        connectionState: ConnectionState.CheckingProvider,
    });
    const [ensNames, setEnsNames] = useState<Map<string, string>>(
        new Map<string, string>(),
    );

    const [contacts, setContacts] = useState<Account[] | undefined>();
    const [selectedContact, setSelectedContact] = useState<
        Account | undefined
    >();

    const [newMessages, setNewMessages] = useState<Envelop[]>([]);

    useEffect(() => {
        if (
            apiConnection.connectionState === ConnectionState.SignedIn &&
            !apiConnection.socket
        ) {
            const socket = socketIOClient(
                process.env.REACT_APP_BACKEND as string,
                { autoConnect: false },
            );
            socket.auth = {
                account: apiConnection.account,
                token: apiConnection.sessionToken,
            };
            socket.connect();
            socket.on('message', (envelop: Envelop) => {
                log('New messages');

                setNewMessages((oldMessages) => oldMessages.concat(envelop));
            });
            changeApiConnection({ socket });
        }
    }, [apiConnection.connectionState, apiConnection.socket]);

    const changeApiConnection = (newApiConnection: Partial<ApiConnection>) => {
        if (newApiConnection.connectionState) {
            log(
                `Changing state from ${
                    ConnectionState[apiConnection.connectionState]
                } to ${ConnectionState[newApiConnection.connectionState]}`,
            );
        }

        if (newApiConnection.sessionToken) {
            log(
                `Retrieved new session token: ${newApiConnection.sessionToken}`,
            );
        }

        if (newApiConnection.account) {
            log(`Account: ${newApiConnection.account.address}`);
        }

        if (newApiConnection.provider) {
            log(`Provider set`);
        }

        if (newApiConnection.provider) {
            log(`Socket set`);
        }

        setApiConnection({ ...apiConnection, ...newApiConnection });
    };

    const createWeb3Provider = async () => {
        const web3Provider = await getWeb3Provider(
            await detectEthereumProvider(),
        );

        if (web3Provider.provider) {
            changeApiConnection({
                provider: web3Provider.provider,
                connectionState: web3Provider.connectionState,
            });
        } else {
            changeApiConnection({
                connectionState: web3Provider.connectionState,
            });
        }
    };

    const requestContacts = async (connection: ApiConnection) => {
        const retrievedContacts = await getContacts(
            (apiConnection.account as Account).address,
            apiConnection.sessionToken as string,
        );

        setContacts(retrievedContacts);

        (
            await Promise.all(
                retrievedContacts.map(async (contact) => ({
                    address: contact.address,
                    ens: await lookupAddress(
                        connection.provider as ethers.providers.JsonRpcProvider,
                        contact.address,
                    ),
                })),
            )
        )
            .filter((lookup) => lookup.ens !== null)
            .forEach((lookup) =>
                ensNames.set(lookup.address, lookup.ens as string),
            );

        setEnsNames(new Map(ensNames));
    };

    const selectContact = async (contactAddress: Account) => {
        if (!isWidgetOpened()) {
            toggleWidget();
        }

        setSelectedContact(contactAddress);
    };

    useEffect(() => {
        if (!apiConnection.provider) {
            createWeb3Provider();
        }
    }, [apiConnection.provider]);

    useEffect(() => {
        if (!contacts && apiConnection.sessionToken) {
            requestContacts(apiConnection);
        }
    }, [apiConnection.sessionToken]);

    return (
        <div className="container">
            <div className="row main-content-row">
                <div className="col-12 h-100">
                    {apiConnection.connectionState ===
                        ConnectionState.NoProvider && (
                        <div className="col-md-12 text-center">
                            No Ethereum provider detected.
                        </div>
                    )}

                    <div className="row header-row">
                        <div
                            className={
                                `account-name-container col-4 text-center` +
                                ` d-flex justify-content-center align-items-center`
                            }
                        >
                            {apiConnection.account && (
                                <AccountNameHeader
                                    account={apiConnection.account}
                                    ensNames={ensNames}
                                    apiConnection={apiConnection}
                                    changeApiConnection={changeApiConnection}
                                />
                            )}
                        </div>
                        <div
                            className={
                                `col-8 text-center chat-header account-name-container` +
                                ` d-flex justify-content-center align-items-center`
                            }
                        >
                            {selectedContact && (
                                <ChatHeader
                                    account={selectedContact}
                                    ensNames={ensNames}
                                />
                            )}
                            {apiConnection.connectionState !==
                                ConnectionState.SignedIn && (
                                <div className="account-name">
                                    {apiConnection.connectionState ===
                                    ConnectionState.KeyCreation
                                        ? 'Add Public Key'
                                        : 'ENS Mail'}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="row body-row">
                        <div className="col-md-4">
                            <div className="row">
                                <div className="col-12 text-center contact-list-container">
                                    <AddContactForm
                                        apiConnection={apiConnection}
                                        requestContacts={requestContacts}
                                    />
                                </div>
                            </div>
                            {contacts &&
                                apiConnection.connectionState ===
                                    ConnectionState.SignedIn && (
                                    <div className="row">
                                        <div className="col-12 text-center contact-list-container">
                                            <ContactList
                                                ensNames={ensNames}
                                                contacts={contacts}
                                                selectContact={selectContact}
                                                newMessages={newMessages}
                                            />
                                        </div>
                                    </div>
                                )}
                            {apiConnection.connectionState ===
                                ConnectionState.KeyCreation && (
                                <AddPubKeyView
                                    apiConnection={apiConnection}
                                    setPublicKey={(keys: Keys) =>
                                        changeApiConnection({
                                            account: {
                                                address: (
                                                    apiConnection.account as Account
                                                ).address,
                                                keys,
                                            },
                                        })
                                    }
                                    switchToSignedIn={() =>
                                        changeApiConnection({
                                            connectionState:
                                                ConnectionState.SignedIn,
                                        })
                                    }
                                />
                            )}
                            {showSignIn(apiConnection.connectionState) && (
                                <SignIn
                                    apiConnection={apiConnection}
                                    changeApiConnection={changeApiConnection}
                                    setEnsNames={setEnsNames}
                                    ensNames={ensNames}
                                />
                            )}
                        </div>
                        <div className="col-md-8 content-container h-100">
                            {!selectedContact && (
                                <div className="start-chat">
                                    {apiConnection.provider &&
                                        showSignIn(
                                            apiConnection.connectionState,
                                        ) && (
                                            <div className="col-md-12 text-center">
                                                <SignInHelp />
                                            </div>
                                        )}
                                    {apiConnection.connectionState ===
                                        ConnectionState.SignedIn && (
                                        <Start
                                            contacts={contacts}
                                            apiConnection={apiConnection}
                                            changeApiConnection={
                                                changeApiConnection
                                            }
                                        />
                                    )}

                                    {apiConnection.connectionState ===
                                        ConnectionState.KeyCreation && (
                                        <AddPubKeyHelper />
                                    )}
                                </div>
                            )}

                            {apiConnection.connectionState ===
                                ConnectionState.SignedIn &&
                                selectedContact && (
                                    <Chat
                                        hasContacts={
                                            contacts !== undefined &&
                                            contacts.length > 0
                                        }
                                        contact={selectedContact}
                                        ensNames={ensNames}
                                        apiConnection={apiConnection}
                                        newMessages={newMessages}
                                        setNewMessages={setNewMessages}
                                    />
                                )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;