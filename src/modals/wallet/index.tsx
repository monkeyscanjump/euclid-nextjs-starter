"use client";
import React from "react";
import {
    connectClient,
    useWalletStore,
} from "@/src/zustand/wallet";
import { useCodegenGeneratedChainsAllChainsQuery } from "@euclidprotocol/graphql-codegen/dist/src/react";
import { useWalletModalStore } from "./state";
import { Modal } from "@/src/components/ui/modal";
import ChainItem from "@/src/components/chain";

function WalletModal() {
    const { isModalOpen, onModalStateChange } = useWalletModalStore();
    const { chain: connectedChain } = useWalletStore()

    const { data: chains } = useCodegenGeneratedChainsAllChainsQuery({
        variables: {},
    });

    const handleConnect = async (chain_uid: string) => {
        try {
            await connectClient(chain_uid);
            onModalStateChange(false);
        } catch (error) {
            console.error("Connection failed:", error);
        }
    };

    const filteredChains = chains?.chains?.all_chains.filter(
        (chain) => !chain.chain_uid.toLowerCase().includes("vsl")
    );

    return (
        <Modal
            open={isModalOpen}
            onOpenChange={onModalStateChange}
            title="Select Chain"
            description="Choose a blockchain network to connect your wallet."
        >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-1">
                {filteredChains?.map((chain) =>
                    chain.factory_address !== "" && (
                        <ChainItem
                            key={chain.chain_uid}
                            chain={chain}
                            selected={chain.chain_uid === connectedChain?.chain_uid}
                            onClick={() => handleConnect(chain.chain_uid)}
                        />
                    )
                )}
            </div>
        </Modal>
    );
}

export default WalletModal;