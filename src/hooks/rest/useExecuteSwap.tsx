import { signAndBroadcastExecute, useWalletStore } from "@/src/zustand/wallet";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { CrossChainUserWithLimit, TokenWithDenom, TxResult } from "./types";
import restClient from "@/lib/rest"; // This now works with default export

export interface IExecuteSwap {
  amountIn: string;
  assetIn: TokenWithDenom;
  assetOut: string;
  minAmountOut: string;
  swaps: string[];
  timeout?: number;
  crossChainAddresses: CrossChainUserWithLimit[];
}

export const useExecuteSwap = () => {
  const { wallet, chain } = useWalletStore();

  return useMutation({
    mutationFn: async (data: IExecuteSwap) => {
      try {
        console.log("Starting swap execution with data:", data);
        console.log("Wallet state:", { wallet: wallet?.bech32Address, chain: chain?.chain_uid });

        // Validate wallet and chain before proceeding
        if (!wallet?.bech32Address || !chain?.chain_uid) {
          throw new Error("Wallet or chain not properly connected");
        }

        // Prepare the API payload
        const payload = {
          amount_in: data.amountIn,
          asset_in: data.assetIn,
          asset_out: data.assetOut,
          cross_chain_addresses: data.crossChainAddresses || [],
          min_amount_out: data.minAmountOut,
          sender: {
            address: wallet.bech32Address,
            chain_uid: chain.chain_uid,
          },
          swaps: data.swaps,
          ...(data.timeout && { timeout: data.timeout }),
        };

        console.log("API payload:", payload);

        // Make the API call to get transaction messages
        const msg = await restClient.post<TxResult>("/execute/swap", payload);
        console.log("API response:", msg);

        // Validate the response structure
        if (!msg || !msg.msgs || !Array.isArray(msg.msgs)) {
          console.error("Invalid API response structure:", msg);
          throw new Error("Invalid response from swap API");
        }

        console.log("Executing transaction with msgs:", msg.msgs);

        // Execute the transaction on-chain
        const tx = await signAndBroadcastExecute(msg.msgs, "Swap");
        console.log("Transaction broadcast successful:", tx);

        return tx;

      } catch (error) {
        console.error("Swap execution error:", error);

        // Enhanced error handling with specific messages
        if (error instanceof Error) {
          let enhancedMessage = error.message;

          // Check for specific error patterns and provide better messages
          if (error.message.toLowerCase().includes('insufficient')) {
            enhancedMessage = "Insufficient balance to complete this swap";
          } else if (error.message.toLowerCase().includes('server error')) {
            enhancedMessage = "Server error occurred. This might be due to insufficient balance or invalid swap parameters.";
          } else if (error.message.toLowerCase().includes('invalid request')) {
            enhancedMessage = "Invalid swap request. Please check your token selection and amounts.";
          } else if (error.message.toLowerCase().includes('timeout')) {
            enhancedMessage = "Request timed out. Please try again.";
          } else if (error.message.includes('Wallet or chain not properly connected')) {
            enhancedMessage = "Please reconnect your wallet and try again.";
          } else if (error.message.includes('Invalid response from swap API')) {
            enhancedMessage = "Unexpected response from server. Please try again.";
          }

          // Create new error with enhanced message but preserve original for logging
          const enhancedError = new Error(enhancedMessage);
          enhancedError.cause = error;
          throw enhancedError;
        }

        // Re-throw unknown errors
        throw error;
      }
    },

    onSuccess: (data) => {
      console.log("Swap transaction successful:", data);
      toast.success(`Swap successful! Transaction: ${data.transactionHash}`);
    },

    onError: (error) => {
      console.error("Swap transaction failed:", error);

      let errorMessage = "Unknown error occurred during swap";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Show error toast
      toast.error(`Swap failed: ${errorMessage}`, {
        duration: 6000,
      });
    },
  });
};