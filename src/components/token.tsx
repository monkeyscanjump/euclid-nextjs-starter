"use client"
import { useCodegenGeneratedTokenTokenMetadataByIdQuery } from "@euclidprotocol/graphql-codegen/dist/src/react";
import Image from "next/image";
import React, { memo } from "react";

interface Props {
    token: string;
}

const Token: React.FC<Props> = memo(({ token }) => {
    const { data: metadata, loading, networkStatus } = useCodegenGeneratedTokenTokenMetadataByIdQuery({
        variables: {
            token_token_metadata_by_id_token_id: token,
        },
        fetchPolicy: "cache-first",
        errorPolicy: "ignore",
        notifyOnNetworkStatusChange: true,
    });

    const hasMetadata = metadata?.token?.token_metadata_by_id;

    // Only show loading if we're actually fetching from network AND don't have data
    // networkStatus 1 = loading, 7 = ready, 2 = setVariables, 3 = fetchMore, etc.
    const isActuallyLoading = loading && !hasMetadata && networkStatus === 1;

    if (isActuallyLoading) {
        return (
            <div className="flex flex-row items-center gap-x-2 h-6">
                <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin flex-shrink-0" />
                <div className="flex-1 h-3 bg-muted/50 rounded animate-pulse" />
            </div>
        );
    }

    return (
        <div className="flex flex-row items-center gap-x-2 h-6">
            <Image
                src={hasMetadata?.image || "/logo.png"}
                alt={hasMetadata?.tokenId ?? token}
                width={20}
                height={20}
                className="flex-shrink-0"
                loading="lazy"
            />
            <div className="text-sm truncate">
                {hasMetadata?.displayName || token}
            </div>
        </div>
    );
});

Token.displayName = 'Token';

export default Token;