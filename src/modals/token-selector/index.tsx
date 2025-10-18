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
    const { isModalOpen, onCloseModal, title, description, onTokenSelect, selectedToken } = useTokenSelectorModalStore();
    const [search, setSearch] = useState("");
    const [scrollTop, setScrollTop] = useState(0);
    const [itemHeight, setItemHeight] = useState(60);
    const [hasScrolledToSelected, setHasScrolledToSelected] = useState(false);
    const measureRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch tokens when modal opens
    const { data: tokensData, loading, refetch } = useCodegenGeneratedRouterAllTokensQuery({
        variables: {},
        skip: !isModalOpen,
        fetchPolicy: "cache-first",
        errorPolicy: "all",
        notifyOnNetworkStatusChange: true,
    });

    const tokens = useMemo(() => {
        return tokensData?.router.all_tokens.tokens ?? [];
    }, [tokensData?.router.all_tokens.tokens]);

    const filteredTokens = useMemo(() => {
        if (!search || search.length < 2) return tokens;
        const searchLower = search.toLowerCase();
        return tokens.filter(token => token.toLowerCase().includes(searchLower));
    }, [tokens, search]);

    const tokenRows = useMemo(() => {
        const rows = [];
        for (let i = 0; i < filteredTokens.length; i += COLUMNS) {
            rows.push(filteredTokens.slice(i, i + COLUMNS));
        }
        return rows;
    }, [filteredTokens]);

    const selectedTokenPosition = useMemo(() => {
        if (!selectedToken) return null;

        const tokenIndex = filteredTokens.indexOf(selectedToken);
        if (tokenIndex === -1) return null;

        const rowIndex = Math.floor(tokenIndex / COLUMNS);
        const columnIndex = tokenIndex % COLUMNS;

        return { rowIndex, columnIndex, tokenIndex };
    }, [selectedToken, filteredTokens]);

    const scrollToSelectedToken = useCallback(() => {
        if (!selectedTokenPosition || !scrollContainerRef.current || hasScrolledToSelected) return;

        const { rowIndex } = selectedTokenPosition;
        const targetScrollTop = rowIndex * itemHeight;

        const containerHeight = scrollContainerRef.current.clientHeight;
        const centeredScrollTop = Math.max(0, targetScrollTop - (containerHeight / 2) + (itemHeight / 2));

        scrollContainerRef.current.scrollTop = centeredScrollTop;
        setScrollTop(centeredScrollTop);
        setHasScrolledToSelected(true);
    }, [selectedTokenPosition, itemHeight, hasScrolledToSelected]);

    // Reset search and scroll when modal opens
    useEffect(() => {
        if (isModalOpen) {
            setSearch("");
            setScrollTop(0);
            setHasScrolledToSelected(false);
            if (refetch) {
                refetch();
            }
        }
    }, [isModalOpen, refetch]);

    // Reset scroll when search changes
    useEffect(() => {
        setHasScrolledToSelected(false);
        setScrollTop(0);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [search]);

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

    // Auto-scroll to selected token after height is measured
    useEffect(() => {
        if (itemHeight > 0 && selectedTokenPosition && !hasScrolledToSelected && isModalOpen && !loading) {
            const timeoutId = setTimeout(scrollToSelectedToken, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [itemHeight, selectedTokenPosition, hasScrolledToSelected, isModalOpen, loading, scrollToSelectedToken]);

    // Virtual scrolling
    const startRow = Math.floor(scrollTop / itemHeight);
    const endRow = Math.min(startRow + VISIBLE_ROWS, tokenRows.length);
    const visibleRows = tokenRows.slice(startRow, endRow);
    const totalHeight = tokenRows.length * itemHeight;

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    const handleTokenSelect = useCallback((token: string) => {
        setSearch("");
        onTokenSelect(token);
        onCloseModal();
    }, [onTokenSelect, onCloseModal]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
    }, []);

    const handleOpenChange = useCallback((open: boolean) => {
        if (!open) {
            setSearch("");
            setScrollTop(0);
            setHasScrolledToSelected(false);
            onCloseModal();
        }
    }, [onCloseModal]);

    // Wait for modal animation to complete before focusing
    useEffect(() => {
        if (isModalOpen && inputRef.current) {
            const timeoutId = setTimeout(() => {
                // Double check modal is still open and element exists
                if (isModalOpen && inputRef.current) {
                    // Check if modal animation is complete by looking for aria-hidden
                    const modalElement = inputRef.current.closest('[role="dialog"]');
                    if (modalElement && !modalElement.getAttribute('aria-hidden')) {
                        inputRef.current.focus();
                    }
                }
            }, 300); // 300ms to ensure animation is done
            return () => clearTimeout(timeoutId);
        }
    }, [isModalOpen]);

    return (
        <Modal
            open={isModalOpen}
            onOpenChange={handleOpenChange}
            title={title}
            description={description}
        >
            <div className="flex flex-col gap-4 h-full">
                <Input
                    ref={inputRef}
                    value={search}
                    onChange={handleSearchChange}
                    placeholder={description}
                    autoComplete="off"
                    autoFocus={false}
                />

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-sm text-muted-foreground">
                            Loading tokens...
                            {search && search.length >= 2 && (
                                <div className="text-xs mt-1">
                                    Searching for "{search}"
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div
                        ref={(el) => {
                            measureRef.current = el;
                            scrollContainerRef.current = el;
                        }}
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
                                            className={`
                                                rounded-md p-2 cursor-pointer transition-colors
                                                ${token === selectedToken
                                                    ? 'bg-blue-600/30 border border-blue-500/50 hover:bg-blue-600/40'
                                                    : 'bg-slate-800/50 hover:bg-slate-800/70'
                                                }
                                            `}
                                        >
                                            <Token token={token} />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!loading && filteredTokens.length === 0 && search && search.length >= 2 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                        No tokens found matching &ldquo;{search}&rdquo;
                    </div>
                )}

                {!loading && tokens.length === 0 && !search && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                        No tokens available
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default TokenSelectorModal;