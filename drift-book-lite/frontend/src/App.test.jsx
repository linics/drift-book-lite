import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: mockPost,
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
    { id: "book-6", title: "第六本书", messageCount: 7 },
  ],
  featuredReviews: [
    {
      id: "review-1",
      bookId: "book-1",
      bookTitle: "第一本书",
      content: "精选内容 1",
      displayName: "2025届 王小明",
      sequenceNumber: 3,
    },
    {
      id: "review-2",
      bookId: "book-2",
      bookTitle: "第二本书",
      content: "精选内容 2",
      displayName: "2025届 李小红",
      sequenceNumber: 4,
    },
    {
      id: "review-3",
      bookId: "book-3",
      bookTitle: "第三本书",
      content: "精选内容 3",
      displayName: "2025届 张小强",
      sequenceNumber: 5,
    },
    {
      id: "review-4",
      bookId: "book-4",
      bookTitle: "第四本书",
      content: "精选内容 4",
      displayName: "2025届 周小雨",
      sequenceNumber: 6,
    },
    {
      id: "review-5",
      bookId: "book-5",
      bookTitle: "第五本书",
      content: "精选内容 5",
      displayName: "2025届 吴小雪",
      sequenceNumber: 7,
    },
    {
      id: "review-6",
      bookId: "book-6",
      bookTitle: "第六本书",
      content: "精选内容 6",
      displayName: "2025届 郑小青",
      sequenceNumber: 8,
    },
  ],
};

function mockSiteData() {
  mockGet.mockImplementation((path) => {
    if (path === "/site-assets") return Promise.resolve({ data: siteAssetsPayload });
    if (path === "/homepage") return Promise.resolve({ data: homepagePayload });
    return Promise.reject(new Error(`Unexpected GET: ${path}`));
  });
}

describe("HomePage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockSiteData();
  });

  test("renders hero heading and search button", async () => {
    render(<App />);

    const hero = await screen.findByTestId("homepage-hero");
    expect(within(hero).getByRole("heading", { name: /让这本书/ })).toBeInTheDocument();
    expect(within(hero).getByRole("button", { name: "搜索图书" })).toBeInTheDocument();
  });

  test("rankings section shows preview limit of 5 per list", async () => {
    render(<App />);

    await screen.findByTestId("homepage-rankings");

    // activityBooks has 6 entries but preview limit is 5
    expect(screen.getAllByTestId("activity-ranking-link")).toHaveLength(5);

    // featuredReviews has 6 entries but preview limit is 5
    expect(screen.getAllByTestId("featured-ranking-link")).toHaveLength(5);
  });

  test("rankings use a shared aligned grid with five row slots", async () => {
    render(<App />);

    const rankings = await screen.findByTestId("homepage-rankings");
    const sharedGrid = within(rankings).getByTestId("ranking-shared-grid");

    expect(sharedGrid).toHaveAttribute("data-layout", "shared-ranking-grid");
    expect(within(sharedGrid).getAllByTestId("ranking-row-slot")).toHaveLength(5);
    expect(within(sharedGrid).getByTestId("activity-ranking-heading")).toBeInTheDocument();
    expect(within(sharedGrid).getByTestId("featured-ranking-heading")).toBeInTheDocument();
  });

  test("restores the previous homepage copy while keeping 5-item previews", async () => {
    render(<App />);

    const hero = await screen.findByTestId("homepage-hero");
    expect(
      within(hero).getByText(/在"一本书的漂流"里，寻找一本书，留下你的那一层，看见阅读真正流动起来。/)
    ).toBeInTheDocument();
    expect(within(hero).getByText(/从一次搜索开始，找到那本正在流动的书。/)).toBeInTheDocument();
    expect(
      screen.getByText(/图书馆是我们阅读漂流的共同起点。从这里出发，留下属于你的那一层阅读印记。/)
    ).toBeInTheDocument();
    expect(screen.getByText(/找一本正在流动的书，接上属于你的那一层。/)).toBeInTheDocument();
    expect(screen.getByText(/先读几段有代表性的接龙片段，再决定从哪本书进入。/)).toBeInTheDocument();
    expect(
      screen.getByText(/阅读从来不是一件孤独的事。找到一本书，留下你的声音，让它继续流向下一位读者。/)
    ).toBeInTheDocument();
  });

  test("process section appears after rankings section", async () => {
    render(<App />);

    const rankings = await screen.findByTestId("homepage-rankings");
    const process = await screen.findByTestId("homepage-process");

    expect(
      rankings.compareDocumentPosition(process) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  test("shows empty state when no activity books", async () => {
    mockGet.mockImplementation((path) => {
      if (path === "/site-assets") return Promise.resolve({ data: siteAssetsPayload });
      if (path === "/homepage")
        return Promise.resolve({ data: { activityBooks: [], featuredReviews: [] } });
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    render(<App />);

    const rankings = await screen.findByTestId("homepage-rankings");
    expect(
      within(rankings).getByText(/还没有公开接龙/)
    ).toBeInTheDocument();
  });
});

describe("SearchPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockImplementation((path) => {
      if (path === "/site-assets") return Promise.resolve({ data: siteAssetsPayload });
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });
  });

  test("renders search form and shows results", async () => {
    mockGet.mockImplementation((path) => {
      if (path === "/site-assets") return Promise.resolve({ data: siteAssetsPayload });
      if (path === "/books/search")
        return Promise.resolve({
          data: {
            books: [
              { id: "b1", title: "测试图书", author: "测试作者", publisher: "测试出版社", totalCopies: 2, barcodes: [] },
            ],
          },
        });
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    // navigate to search page with query
    window.history.pushState({}, "", "/search?q=测试");
    render(<App />);

    expect(await screen.findByText("测试图书")).toBeInTheDocument();
    expect(screen.getByText(/共找到 1 本/)).toBeInTheDocument();
  });

  test("shows empty state when no books found", async () => {
    mockGet.mockImplementation((path) => {
      if (path === "/site-assets") return Promise.resolve({ data: siteAssetsPayload });
      if (path === "/books/search")
        return Promise.resolve({ data: { books: [] } });
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    window.history.pushState({}, "", "/search?q=不存在的书名");
    render(<App />);

    expect(await screen.findByText(/未找到相关图书/)).toBeInTheDocument();
  });
});

describe("BookDetailPage", () => {
  const bookPayload = {
    book: {
      id: "bk1",
      title: "漂流书目",
      author: "漂流作者",
      publisher: "漂流出版社",
      totalCopies: 3,
      barcodes: ["000001", "000002"],
    },
  };

  const reviewsPayload = {
    reviews: [
      {
        id: "r1",
        displayName: "2025届 王小明",
        content: "这是一条接龙留言。",
        sequenceNumber: 1,
        reviewedAt: "2026-01-01T00:00:00Z",
      },
    ],
  };

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockImplementation((path) => {
      if (path === "/site-assets") return Promise.resolve({ data: siteAssetsPayload });
      if (path === "/books/bk1") return Promise.resolve({ data: bookPayload });
      if (path === "/books/bk1/reviews") return Promise.resolve({ data: reviewsPayload });
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });
    window.history.pushState({}, "", "/books/bk1");
  });

  test("displays book title and review content", async () => {
    render(<App />);

    expect(await screen.findByText("漂流书目")).toBeInTheDocument();
    expect(await screen.findByText("这是一条接龙留言。")).toBeInTheDocument();
  });

  test("displays barcodes", async () => {
    render(<App />);

    expect(await screen.findByText("000001")).toBeInTheDocument();
    expect(await screen.findByText("000002")).toBeInTheDocument();
  });

  test("shows empty state when no reviews", async () => {
    mockGet.mockImplementation((path) => {
      if (path === "/site-assets") return Promise.resolve({ data: siteAssetsPayload });
      if (path === "/books/bk1") return Promise.resolve({ data: bookPayload });
      if (path === "/books/bk1/reviews") return Promise.resolve({ data: { reviews: [] } });
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    render(<App />);

    expect(await screen.findByText(/还没有公开接龙/)).toBeInTheDocument();
  });

  test("submit review form allows omitting id card suffix", async () => {
    mockPost.mockResolvedValue({ data: { message: "留言已提交，等待审核。" } });

    render(<App />);

    // wait for page to load
    await screen.findByText("漂流书目");

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("例如 320250002"), "320250001");
    await user.type(screen.getByPlaceholderText("请输入学籍姓名"), "王小明");
    await user.type(screen.getByPlaceholderText("写下你想接上的这一层内容。"), "测试接龙内容");

    await user.click(screen.getByRole("button", { name: "提交并进入审核" }));

    expect(await screen.findByText("留言已提交，等待审核。")).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith(
      "/books/bk1/reviews",
      expect.objectContaining({
        systemId: "320250001",
        studentName: "王小明",
        idCardSuffix: "",
      })
    );
  });

  test("submit review form supports teacher identity", async () => {
    mockPost.mockResolvedValue({ data: { message: "留言已提交，等待审核。" } });

    render(<App />);

    await screen.findByText("漂流书目");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "教师" }));
    expect(screen.queryByPlaceholderText("例如 320250002")).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("请输入教师姓名"), "马伟");
    await user.type(screen.getByPlaceholderText("写下你想接上的这一层内容。"), "教师接龙内容");

    await user.click(screen.getByRole("button", { name: "提交并进入审核" }));

    expect(await screen.findByText("留言已提交，等待审核。")).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith(
      "/books/bk1/reviews",
      expect.objectContaining({
        identityType: "teacher",
        teacherName: "马伟",
        content: "教师接龙内容",
      })
    );
  });
});
