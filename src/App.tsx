import React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import "./index.css";

import { useVirtualizer } from "@tanstack/react-virtual";

type Row = { id: number; text: string };
async function fetchServerPage(
  limit: number,
  offset: number = 0,
  direction: "forward" | "backward" = "forward"
): Promise<{ rows: Row[]; nextOffset: number }> {
  console.log("---fetchServerPage", limit, offset);
  let rows;
  if (direction === "forward") {
    rows = new Array(limit).fill(0).map((_e, i) => {
      console.log("row -", i + offset, "offset", offset, "limit", limit);
      return {
        id: i + offset,
        text: `Async loaded row #${i + offset}`,
      };
    });
  } else {
    rows = new Array(limit).fill(0).map((_e, i) => {
      console.log(
        "row -",
        offset - limit + i,
        "offset",
        offset,
        "limit",
        limit
      );
      return {
        id: offset - limit + i,
        text: `Async loaded row #${offset - limit + i}`,
      };
    });
  }

  await new Promise((r) => setTimeout(r, 2000));

  console.log(`rows - returning ${offset} to ${offset + limit}`);
  const nextOffset = offset + limit;
  console.log(`rows - offset: ${offset}, nextOffset: ${nextOffset}`);

  return { rows, nextOffset: nextOffset };
}

export function App() {
  const {
    status,
    data,
    error,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
  } = useInfiniteQuery({
    queryKey: ["projects"],
    queryFn: (ctx) => fetchServerPage(10, ctx.pageParam, ctx.direction),
    initialPageParam: 0,
    getNextPageParam: (lastGroup) => {
      const next = [...lastGroup.rows].pop()!.id + 1;
      console.log("row... getNextPageParam", next);
      return next;
    },
    maxPages: 3,
    getPreviousPageParam: (firstGroup) => firstGroup.rows[0].id,
  });

  const allRows = data ? data.pages.flatMap((d) => d.rows) : [];

  const parentRef = React.useRef(null);

  let count = allRows.length;
  if (hasNextPage) count++;
  if (hasPreviousPage) count++;

  const rowVirtualizer = useVirtualizer({
    count: count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 20,
  });

  const lastItem = [...rowVirtualizer.getVirtualItems()].reverse()[0];
  const firstItem = [...rowVirtualizer.getVirtualItems()][0];

  console.log(firstItem, lastItem);

  React.useEffect(() => {
    rowVirtualizer.scrollToOffset(Infinity);
  }, [rowVirtualizer]);

  React.useEffect(() => {
    if (!firstItem) {
      return;
    }

    if (
      firstItem.index <= allRows[0].id &&
      !(lastItem.index >= allRows.length - 1) && // prevent fetching both directions
      hasPreviousPage &&
      !isFetchingPreviousPage
    ) {
      fetchPreviousPage().then(() => {
        rowVirtualizer.scrollToOffset(-Infinity);
      });
    }
  });

  React.useEffect(() => {
    if (!lastItem) {
      return;
    }

    if (
      lastItem.index >= allRows.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage().then(() => {
        rowVirtualizer.scrollToOffset(Infinity);
      });
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allRows.length,
    isFetchingNextPage,
    rowVirtualizer,
    lastItem,
  ]);

  return (
    <div>
      <p>
        This infinite scroll example uses React Query's useInfiniteScroll hook
        to fetch infinite data from a posts endpoint and then a rowVirtualizer
        is used along with a loader-row placed at the bottom of the list to
        trigger the next page to load.
      </p>

      <br />
      <br />

      <button onClick={() => rowVirtualizer.scrollToIndex(Infinity)}>
        Resume live
      </button>

      {status === "pending" ? (
        <p>Loading...</p>
      ) : status === "error" ? (
        <span>Error: {(error as Error).message}</span>
      ) : (
        <div
          ref={parentRef}
          className="List"
          style={{
            height: `500px`,
            width: `100%`,
            overflow: "auto",
          }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const isLoaderRow = virtualRow.index > allRows.length - 1;
              const post = allRows[virtualRow.index];

              return (
                <div
                  key={virtualRow.index}
                  className={
                    virtualRow.index % 2 ? "ListItemOdd" : "ListItemEven"
                  }
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {isLoaderRow
                    ? hasNextPage
                      ? "Loading more..."
                      : "Nothing more to load"
                    : post.text}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div>
        {isFetching && !isFetchingNextPage ? "Background Updating..." : null}
      </div>
    </div>
  );
}
