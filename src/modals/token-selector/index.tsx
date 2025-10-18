"use client";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useTokenSelectorModalStore } from "./state";
import { Modal } from "@/src/components/ui/modal";
import Token from "@/src/components/token";
import { Input } from "@/src/components/ui/input";
import { useCodegenGeneratedRouterAllTokensQuery } from "@euclidprotocol/graphql-codegen/dist/src/react";

const COLUMNS = 3;
const VISIBLE_ROWS = 8;

function TokenSelectorModal() {
    const { isModalOpen, onCloseModal, title, description, onTokenSelect } = useTokenSelectorModalStore();
    const [search, setSearch] = useState("");
    const [scrollTop, setScrollTop] = useState(0);
    const [itemHeight, setItemHeight] = useState(60); // Default, will be measured
    const measureRef = useRef<HTMLDivElement>(null);

    // Fetch tokens when modal opens
    const { data: tokensData, loading } = useCodegenGeneratedRouterAllTokensQuery({
        variables: {},
        skip: !isModalOpen,
        fetchPolicy: "cache-first",
    });

    const tokens = useMemo(() => {
        return tokensData?.router.all_tokens.tokens ?? [];
    }, [tokensData?.router.all_tokens.tokens]);

    // Client-side filtering
    const filteredTokens = useMemo(() => {
        if (!search || search.length < 2) return tokens;
        const searchLower = search.toLowerCase();
        return tokens.filter(token => token.toLowerCase().includes(searchLower));
    }, [tokens, search]);

    // Group tokens into rows for virtual scrolling
    const tokenRows = useMemo(() => {
        const rows = [];
        for (let i = 0; i < filteredTokens.length; i += COLUMNS) {
            rows.push(filteredTokens.slice(i, i + COLUMNS));
        }
        return rows;
    }, [filteredTokens]);

    // Measure actual row height from DOM
    useEffect(() => {
        if (measureRef.current && tokenRows.length > 0) {
            const measureHeight = () => {
                if (measureRef.current) {
                    const firstRow = measureRef.current.querySelector('.token-row');
                    if (firstRow) {
                        const rect = firstRow.getBoundingClientRect();
                        const computedStyle = window.getComputedStyle(firstRow);
                        const marginBottom = parseInt(computedStyle.marginBottom) || 0;
                        const actualHeight = rect.height + marginBottom;
                        setItemHeight(actualHeight);
                    }
                }
            };

            requestAnimationFrame(measureHeight);
        }
    }, [tokenRows.length, isModalOpen]);

    // Virtual scrolling - only render visible rows
    const startRow = Math.floor(scrollTop / itemHeight);
    const endRow = Math.min(startRow + VISIBLE_ROWS, tokenRows.length);
    const visibleRows = tokenRows.slice(startRow, endRow);
    const totalHeight = tokenRows.length * itemHeight;

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    const handleTokenSelect = useCallback((token: string) => {
        onTokenSelect(token);
        onCloseModal();
    }, [onTokenSelect, onCloseModal]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setScrollTop(0); // Reset scroll on search
    }, []);

    return (
        <Modal
            open={isModalOpen}
            onOpenChange={onCloseModal}
            title={title}
            description={description}
        >
            <div className="flex flex-col gap-4 h-full">
                <Input
                    value={search}
                    onChange={handleSearchChange}
                    placeholder={description}
                />

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-sm text-muted-foreground">Loading tokens...</div>
                    </div>
                ) : (
                    <div
                        ref={measureRef}
                        className="mt-4 overflow-auto pl-4 flex-1 max-h-96 custom-scrollbar"
                        onScroll={handleScroll}
                    >
                        <div style={{ height: totalHeight, position: 'relative' }}>
                            {visibleRows.map((row, rowIndex) => (
                                <div
                                    key={startRow + rowIndex}
                                    className="token-row absolute w-full grid grid-cols-2 sm:grid-cols-3 gap-4 pr-4 mb-4"
                                    style={{
                                        top: (startRow + rowIndex) * itemHeight,
                                    }}
                                >
                                    {row.map((token) => (
                                        <div
                                            key={token}
                                            onClick={() => handleTokenSelect(token)}
                                            className="bg-slate-800/50 rounded-md p-2 cursor-pointer hover:bg-slate-800/70"
                                        >
                                            <Token token={token} />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {filteredTokens.length === 0 && search && search.length >= 2 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                        No tokens found matching &ldquo;{search}&rdquo;
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default TokenSelectorModal;