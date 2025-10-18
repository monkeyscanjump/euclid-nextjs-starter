"use client";

import {
    CodegenGeneratedRouterSimulateSwapDocument,
    useCodegenGeneratedRouterAllTokensQuery,
    useCodegenGeneratedRouterSimulateSwapQuery,
    useCodegenGeneratedTokenTokenMetadataByIdQuery,
} from "@euclidprotocol/graphql-codegen/dist/src/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import Token from "../components/token";
import { ChevronDown, Settings, ArrowUpDown } from "lucide-react";
import { useTokenSelectorModalStore } from "../modals/token-selector/state";
import { Input } from "../components/ui/input";
import { convertMacroToMicro, convertMicroToMacro } from "@andromedaprotocol/andromeda.js";
import { useGetRoutes } from "../hooks/rest/useGetRoutes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import PromiseButton from "../components/PromiseButton";
import { DenomSelector } from "../components/DenomSelector";
import { BalanceValue } from "../components/DenomBalance";
import { ITokenType } from "@euclidprotocol/graphql-codegen";
import { useWalletStore } from "../zustand/wallet";
import { useWalletModalStore } from "../modals/wallet/state";
import { useExecuteSwap } from "../hooks/rest/useExecuteSwap";
import { toast } from "sonner";
import { gqlClient } from "@/lib/gql/client";
import reactQueryClient from "@/lib/react-query/client";
import { useGetBalance } from "../hooks/useGetBalance";

interface RouteStep {
    route: string[];
    dex: string;
    amount_in: string;
    amount_out: string;
    chain_uid: string;
    amount_out_for_hops: string[];
}

interface RoutePath {
    path: RouteStep[];
    total_price_impact: string;
}

export default function Swap() {
    const { chain, address } = useWalletStore();
    const { onModalStateChange } = useWalletModalStore();
    const [fromToken, setFromToken] = useState<string>("");
    const [fromTokenAmount, setFromTokenAmount] = useState<string>("");
    const [toToken, setToToken] = useState<string>("");
    const [slippage, setSlippage] = useState<number>(0.5);
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(-1);
    const [selectedFromDenom, setSelectedFromDenom] = useState<ITokenType>({ voucher: {} });

    const hasBothTokens = useMemo(() => fromToken && toToken, [fromToken, toToken]);
    const isRoutingReady = useMemo(() => hasBothTokens && fromToken !== toToken, [hasBothTokens, fromToken, toToken]);

    useEffect(() => {
        setSelectedFromDenom({ voucher: {} });
    }, [fromToken]);

    useEffect(() => {
        setSelectedRouteIndex(-1);
        setShowSettings(false);
    }, [fromToken, toToken]);

    const { onOpenModal } = useTokenSelectorModalStore();
    const { data: tokens, loading } = useCodegenGeneratedRouterAllTokensQuery();

    const { data: fromTokenMetadata } = useCodegenGeneratedTokenTokenMetadataByIdQuery({
        variables: {
            token_token_metadata_by_id_token_id: fromToken || "",
        },
        skip: !fromToken,
    });

    const { data: toTokenMetadata } = useCodegenGeneratedTokenTokenMetadataByIdQuery({
        variables: {
            token_token_metadata_by_id_token_id: toToken || "",
        },
        skip: !toToken,
    });

    const { data: balanceData } = useGetBalance(selectedFromDenom, fromToken || "");
    const { mutateAsync: executeSwap, isPending } = useExecuteSwap();

    const microFromValue = useMemo(() => {
        if (!fromTokenAmount || fromTokenAmount === "0") return "0";
        return convertMacroToMicro(
            fromTokenAmount,
            fromTokenMetadata?.token.token_metadata_by_id.coinDecimal ?? 6
        ).split(".")[0];
    }, [fromTokenAmount, fromTokenMetadata]);

    const routeDiscoveryAmount = useMemo(() => {
        return convertMacroToMicro(
            "1",
            fromTokenMetadata?.token.token_metadata_by_id.coinDecimal ?? 6
        ).split(".")[0];
    }, [fromTokenMetadata]);

    const hasInsufficientBalance = useMemo(() => {
        if (!fromTokenAmount || !balanceData || fromTokenAmount === "0") return false;

        try {
            const inputAmount = parseFloat(fromTokenAmount);
            const availableBalance = parseFloat(balanceData);
            return inputAmount > availableBalance;
        } catch {
            return false;
        }
    }, [fromTokenAmount, balanceData]);

    const shouldFetchRoutes = Boolean(fromToken && toToken && fromToken !== toToken);

    const { data: routes, isLoading: routesLoading } = useGetRoutes({
        tokenIn: fromToken,
        tokenOut: toToken,
        amountIn: routeDiscoveryAmount
    }, {
        enabled: shouldFetchRoutes
    });

    const selectedRoutePath = useMemo(() => {
        if (selectedRouteIndex >= 0 && routes?.paths?.[selectedRouteIndex]) {
            return routes.paths[selectedRouteIndex] as RoutePath;
        }
        return null;
    }, [selectedRouteIndex, routes]);

    useEffect(() => {
        if (routes?.paths?.length && selectedRouteIndex === -1) {
            setSelectedRouteIndex(0);
        } else if (!routes?.paths?.length) {
            setSelectedRouteIndex(-1);
        }
    }, [routes, selectedRouteIndex]);

    const crossChainAddresses = useMemo(() => {
        if (!selectedRoutePath || !address) return [];

        const uniqueChains = new Set<string>();
        selectedRoutePath.path.forEach(step => {
            if (step.chain_uid && step.chain_uid !== chain?.chain_uid) {
                uniqueChains.add(step.chain_uid);
            }
        });

        return Array.from(uniqueChains).map(chainUid => ({
            chain_uid: chainUid,
            address: address
        }));
    }, [selectedRoutePath, chain?.chain_uid, address]);

    const swapRoute = useMemo(() => {
        if (!selectedRoutePath) return [];
        return selectedRoutePath.path.map(step => step.route).flat();
    }, [selectedRoutePath]);

    const { data: simulateSwapResult } = useCodegenGeneratedRouterSimulateSwapQuery({
        variables: {
            router_simulate_swap_amount_in: microFromValue || routeDiscoveryAmount,
            router_simulate_swap_asset_in: fromToken || "",
            router_simulate_swap_asset_out: toToken || "",
            router_simulate_swap_min_amount_out: "1",
            router_simulate_swap_swaps: swapRoute,
        },
        skip: !fromToken || !toToken || swapRoute.length === 0,
    });

    const minAmountOut = useMemo(() => {
        const expectedOut = simulateSwapResult?.router.simulate_swap.amount_out ||
            selectedRoutePath?.path[selectedRoutePath.path.length - 1]?.amount_out ||
            "1";

        const expectedOutBig = BigInt(expectedOut);
        const slippageMultiplier = BigInt(Math.floor((100 - slippage) * 1000));
        const minOut = (expectedOutBig * slippageMultiplier) / BigInt(100000);

        return minOut.toString();
    }, [selectedRoutePath, slippage, simulateSwapResult]);

    const macroAmountOut = useMemo(() => {
        return convertMicroToMacro(
            simulateSwapResult?.router.simulate_swap.amount_out ?? "0",
            toTokenMetadata?.token.token_metadata_by_id.coinDecimal ?? 6
        );
    }, [simulateSwapResult, toTokenMetadata]);

    const isSwapDisabled = useMemo(() => {
        return (
            isPending ||
            !fromToken ||
            !toToken ||
            !address ||
            microFromValue === "0" ||
            !selectedRoutePath ||
            hasInsufficientBalance
        );
    }, [isPending, fromToken, toToken, address, microFromValue, selectedRoutePath, hasInsufficientBalance]);

    const handleSwitchTokens = useCallback(() => {
        const tempFromToken = fromToken;
        setFromToken(toToken);
        setToToken(tempFromToken);
        setFromTokenAmount("");
        setSelectedRouteIndex(-1);
        setShowSettings(false);
        setSelectedFromDenom({ voucher: {} });
    }, [fromToken, toToken]);

    const executeSwapLogic = async (forceSwap: boolean = false) => {
        if (!selectedRoutePath || microFromValue === "0") return;

        if (!forceSwap && hasInsufficientBalance) {
            toast.error("Insufficient balance for swap");
            return;
        }

        if (crossChainAddresses.length > 0) {
            const hasEmptyAddresses = crossChainAddresses.some(addr => !addr.address);
            if (hasEmptyAddresses) {
                toast.error("Missing destination addresses for cross-chain swap");
                return;
            }
        }

        // Debug logging - add wallet state info
        console.log("Wallet Store State:", { chain, address });
        console.log("Swap payload:", {
            amountIn: microFromValue,
            assetIn: {
                token: fromToken!,
                token_type: selectedFromDenom!,
            },
            assetOut: toToken || "",
            crossChainAddresses: crossChainAddresses,
            minAmountOut: minAmountOut,
            swaps: swapRoute,
            currentAddress: address,
            forceSwap: forceSwap,
        });

        try {
            const tx = await executeSwap({
                amountIn: microFromValue,
                assetIn: {
                    token: fromToken!,
                    token_type: selectedFromDenom!,
                },
                assetOut: toToken || "",
                crossChainAddresses: crossChainAddresses,
                minAmountOut: minAmountOut,
                swaps: swapRoute,
                timeout: 600,
            });

            await gqlClient.refetchQueries({
                'include': [CodegenGeneratedRouterSimulateSwapDocument]
            });

            await reactQueryClient.invalidateQueries({
                queryKey: ["rest", "routes"]
            });

            setFromTokenAmount("");
            toast.success(`Swap successful: ${tx.transactionHash}`);
        } catch (error) {
            // @ts-expect-error Error is not typed
            toast.error(`Swap failed: ${error.message}`);
            console.error("Swap failed:", error);
        }
    };

    const handleSwap = () => executeSwapLogic(false);
    const handleForceSwap = () => executeSwapLogic(true);

    const handleMaxAmount = useCallback(() => {
        if (balanceData) {
            setFromTokenAmount(balanceData);
        }
    }, [balanceData]);

    const getRouteDisplayName = (routeSteps: RouteStep[]) => {
        const allTokens = routeSteps.flatMap(step => step.route);
        const uniqueTokens = allTokens.filter((token, index) =>
            allTokens.indexOf(token) === index
        );
        return uniqueTokens.join(" → ").toUpperCase();
    };

    const getRouteSummary = (routeSteps: RouteStep[]) => {
        const chains = new Set(routeSteps.map(step => step.chain_uid));
        const dexes = new Set(routeSteps.map(step => step.dex));
        return {
            chainCount: chains.size,
            dexCount: dexes.size,
            stepCount: routeSteps.length
        };
    };

    const renderRouteSection = () => {
        if (!isRoutingReady) {
            return (
                <div className="flex flex-col gap-4 w-full">
                    <div className="text-center py-2 text-muted-foreground">
                        {!fromToken && !toToken
                            ? "Please select both tokens to see available routes"
                            : fromToken === toToken
                                ? "Please select different tokens"
                                : "Please select both tokens"
                        }
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-4 w-full">
                <div className="flex flex-row gap-5 items-center">
                    <p>Select Route</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSettings(!showSettings)}
                        className="ml-auto"
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>

                {fromTokenAmount && fromTokenAmount !== "0" && selectedRoutePath && (
                    <div className="text-center py-2 bg-green-900/20 rounded-lg border border-green-800/30">
                        <div className="text-sm text-green-300">
                            Minimum received: {convertMicroToMacro(
                                minAmountOut,
                                toTokenMetadata?.token.token_metadata_by_id.coinDecimal ?? 6
                            )} <span className="uppercase">{toToken}</span>
                        </div>
                    </div>
                )}

                {showSettings && (
                    <div className="bg-slate-800/30 rounded-lg p-4 space-y-3">
                        <h4 className="text-sm font-medium">Slippage Tolerance</h4>
                        <div className="flex gap-2">
                            {[0.1, 0.5, 1.0, 3.0].map((preset) => (
                                <Button
                                    key={preset}
                                    variant={slippage === preset ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSlippage(preset)}
                                >
                                    {preset}%
                                </Button>
                            ))}
                            <Input
                                type="number"
                                value={slippage}
                                onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                                className="w-20 h-8"
                                step="0.1"
                                min="0.1"
                                max="50"
                            />
                        </div>
                    </div>
                )}

                {routesLoading ? (
                    <div className="text-center py-4">Loading Routes...</div>
                ) : !routes?.paths?.length ? (
                    <div className="text-center">
                        <div className="text-yellow-500">No Routes Available</div>
                        <div className="text-xs text-muted-foreground mt-1">
                            Try different token pairs
                        </div>
                    </div>
                ) : (
                    <>
                        {(!fromTokenAmount || fromTokenAmount === "0") && (
                            <div className="text-center py-2 bg-blue-900/20 rounded-lg border border-blue-800/30">
                                <div className="text-sm text-blue-300">
                                    Showing available routes • Enter amount for accurate pricing
                                </div>
                            </div>
                        )}

                        <Select
                            value={selectedRouteIndex >= 0 ? selectedRouteIndex.toString() : ""}
                            onValueChange={(value) => setSelectedRouteIndex(parseInt(value))}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Route">
                                    {selectedRoutePath && (
                                        <div className="flex flex-row items-center justify-between w-full">
                                            <span className="uppercase">{getRouteDisplayName(selectedRoutePath.path)}</span>
                                            <div className="flex gap-2 text-xs text-muted-foreground ml-4">
                                                {(() => {
                                                    const summary = getRouteSummary(selectedRoutePath.path);
                                                    return (
                                                        <>
                                                            <span>{summary.stepCount} steps</span>
                                                            <span>{summary.chainCount} chains</span>
                                                            <span>{summary.dexCount} DEXs</span>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {routes.paths.map((pathData, index) => {
                                    const typedPath = pathData as RoutePath;
                                    if (!typedPath?.path?.length) return null;

                                    const summary = getRouteSummary(typedPath.path);
                                    const displayName = getRouteDisplayName(typedPath.path);

                                    return (
                                        <SelectItem key={index} value={index.toString()}>
                                            <div className="flex flex-col gap-1 w-full">
                                                <div className="flex justify-between items-center gap-4">
                                                    <span className="font-medium uppercase">{displayName}</span>
                                                    <span className="text-xs text-green-500">
                                                        Impact: {typedPath.total_price_impact}%
                                                    </span>
                                                </div>
                                                <div className="flex gap-3 text-xs text-muted-foreground">
                                                    <span>{summary.stepCount} steps</span>
                                                    <span>{summary.chainCount} chains</span>
                                                    <span>{summary.dexCount} DEXs</span>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </>
                )}

                {selectedRoutePath && (
                    <div className="bg-slate-800/20 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium">Route Details</h4>
                            <span className="text-xs text-green-500">
                                Price Impact: {selectedRoutePath.total_price_impact}%
                            </span>
                        </div>
                        {selectedRoutePath.path.map((step, index) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">
                                    Step {index + 1}: <span className="uppercase">{step.route.join(" → ")}</span> via <span className="uppercase">{step.dex}</span>
                                </span>
                                <span className="text-xs uppercase">Chain: {step.chain_uid}</span>
                            </div>
                        ))}
                        {crossChainAddresses.length > 0 && (
                            <div className="text-xs text-blue-400">
                                Cross-chain operation: <span className="uppercase">{crossChainAddresses.map(addr => addr.chain_uid).join(", ")}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col items-center mt-10 gap-6 min-w-[500px] max-w-2xl w-fit border border-slate-800 rounded-lg p-4">
            {(fromToken && chain) && (
                <div className="flex flex-row items-center gap-x-2 w-full justify-end">
                    <BalanceValue
                        tokenId={fromToken}
                        selectedDenom={selectedFromDenom}
                    />
                    <DenomSelector
                        selectedDenom={selectedFromDenom}
                        chainUId={chain?.chain_uid ?? ""}
                        tokenId={fromToken}
                        setSelectedDenom={(d) => setSelectedFromDenom(d ?? { voucher: {} })}
                    />
                </div>
            )}

            <div className="w-full space-y-4">
                <div className="relative grid grid-cols-3 gap-x-2 w-full min-w-[450px]">
                    <Button
                        onClick={() =>
                            onOpenModal({
                                tokens: tokens?.router.all_tokens.tokens ?? [],
                                title: "Select From Token",
                                description: "Select the token you want to swap",
                                selectedToken: fromToken,
                                onTokenSelect: (token) => {
                                    setFromToken(token);
                                },
                            })
                        }
                        disabled={loading}
                        size='lg'
                        variant="secondary"
                        className="min-w-0"
                    >
                        {fromToken ? (
                            <div className="flex flex-row items-center gap-x-2 min-w-0">
                                <Token token={fromToken} />
                                <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            </div>
                        ) : (
                            "Select From Token"
                        )}
                    </Button>

                    <div className="relative col-span-2">
                        <Input
                            value={fromTokenAmount}
                            onChange={(e) => setFromTokenAmount(e.target.value)}
                            placeholder="0.00"
                            className="text-lg h-10 pr-16"
                        />
                        {balanceData && fromToken && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleMaxAmount}
                                className="absolute right-1 top-1 h-8 px-2 text-xs"
                            >
                                MAX
                            </Button>
                        )}
                    </div>

                    <div className="absolute left-1/2 -bottom-6 z-10">
                        <Button
                            onClick={handleSwitchTokens}
                            disabled={loading || isPending || !fromToken || !toToken}
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 bg-background border-2 border-slate-600 hover:border-slate-400 rounded-full shadow-md"
                        >
                            <ArrowUpDown className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-x-2 w-full min-w-[450px]">
                    <Button
                        onClick={() =>
                            onOpenModal({
                                tokens: tokens?.router.all_tokens.tokens ?? [],
                                title: "Select To Token",
                                description: "Select the token you want to receive",
                                selectedToken: toToken,
                                onTokenSelect: (token) => {
                                    setToToken(token);
                                },
                            })
                        }
                        disabled={loading}
                        size='lg'
                        variant="secondary"
                        className="min-w-0"
                    >
                        {toToken ? (
                            <div className="flex flex-row items-center gap-x-2 min-w-0">
                                <Token token={toToken} />
                                <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            </div>
                        ) : (
                            "Select To Token"
                        )}
                    </Button>

                    <Input
                        value={macroAmountOut}
                        placeholder="0.00"
                        className="col-span-2 text-lg h-10"
                        readOnly
                        disabled
                    />
                </div>
            </div>

            <div className="h-[1px] bg-slate-800 w-full" />

            {renderRouteSection()}

            {chain ? (
                <div className="w-full space-y-2">
                    {hasInsufficientBalance && (
                        <div className="text-center py-2 bg-red-900/20 rounded-lg border border-red-800/30">
                            <div className="text-sm text-red-300">
                                Insufficient balance. Available: {balanceData} <span className="uppercase">{fromToken}</span>
                            </div>
                        </div>
                    )}

                    <PromiseButton
                        disabled={isSwapDisabled}
                        onClick={handleSwap}
                        className="w-full"
                    >
                        {hasInsufficientBalance
                            ? "Insufficient Balance"
                            : isPending
                                ? "Swapping..."
                                : "Swap"
                        }
                    </PromiseButton>

                    <PromiseButton
                        onClick={handleForceSwap}
                        variant="destructive"
                        className="w-full"
                    >
                        {isPending ? "Force Swapping..." : "Force Swap (Ignore Balance)"}
                    </PromiseButton>
                </div>
            ) : (
                <Button className="w-full" onClick={() => onModalStateChange(true)}>
                    Connect Chain
                </Button>
            )}
        </div>
    );
}