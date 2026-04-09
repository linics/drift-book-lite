import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: vi.fn(),
    }),
  },
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }) => children,
  motion: {
    img: (props) => <img {...props} />,
    div: (props) => <div {...props} />,
  },
}));

import App from "./App";

const siteAssetsPayload = {
  schoolLogoPath: "/uploads/logo.png",
  carouselImages: [
    {
      id: "slide-1",
      enabled: true,
      sortOrder: 1,
      path: "/uploads/hero.jpg",
      label: "图书馆活动轮播",
    },
  ],
  processContent: [
    { id: "step-1", title: "先搜索图书", description: "从首页找到想接龙的书。" },
    { id: "step-2", title: "实名核验", description: "输入学号、姓名和身份证后四位。" },
  ],
};

const homepagePayload = {
  activityBooks: [
    { id: "book-1", title: "第一本书", messageCount: 12 },
    { id: "book-2", title: "第二本书", messageCount: 11 },
    { id: "book-3", title: "第三本书", messageCount: 10 },
    { id: "book-4", title: "第四本书", messageCount: 9 },
    { id: "book-5", title: "第五本书", messageCount: 8 },
  ],
  featuredReviews: [
    {
      id: "review-1",
      bookId: "book-1",
      bookTitle: "第一本书",
      content: "精选内容 1",
      displayName: "高一（1）班 王*",
      sequenceNumber: 3,
    },
    {
      id: "review-2",
      bookId: "book-2",
      bookTitle: "第二本书",
      content: "精选内容 2",
      displayName: "高一（2）班 李*",
      sequenceNumber: 4,
    },
    {
      id: "review-3",
      bookId: "book-3",
      bookTitle: "第三本书",
      content: "精选内容 3",
      displayName: "高一（3）班 张*",
      sequenceNumber: 5,
    },
    {
      id: "review-4",
      bookId: "book-4",
      bookTitle: "第四本书",
      content: "精选内容 4",
      displayName: "高一（4）班 周*",
      sequenceNumber: 6,
    },
  ],
};

describe("HomePage layout", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockImplementation((path) => {
      if (path === "/site-assets") {
        return Promise.resolve({ data: siteAssetsPayload });
      }

      if (path === "/homepage") {
        return Promise.resolve({ data: homepagePayload });
      }

      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
  });

  test("restores a two-panel hero and keeps rankings as lightweight summaries", async () => {
    render(<App />);

    const hero = await screen.findByTestId("homepage-hero");
    const rankings = await screen.findByTestId("homepage-rankings");
    const process = await screen.findByTestId("homepage-process");

    expect(
      within(hero).getByRole("heading", { name: /一条接龙，\s*把一本到下一位读者手里/i })
    ).toBeInTheDocument();
    expect(within(hero).queryByText("实名校验")).not.toBeInTheDocument();
    expect(within(hero).getByRole("button", { name: "搜索图书" })).toBeInTheDocument();

    expect(within(screen.getByTestId("activity-ranking-list")).getAllByRole("link")).toHaveLength(3);
    expect(within(screen.getByTestId("featured-ranking-list")).getAllByRole("link")).toHaveLength(3);

    expect(rankings.compareDocumentPosition(process) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
