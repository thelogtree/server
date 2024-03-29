import { comparisonTypeEnum } from "logtree-types";
import { FolderFactory } from "../factories/FolderFactory";
import { OrganizationFactory } from "../factories/OrganizationFactory";
import { RuleFactory } from "../factories/RuleFactory";
import { UserFactory } from "../factories/UserFactory";
import { LogFactory } from "../factories/LogFactory";
import moment from "moment";
import { RuleService } from "src/services/RuleService";
import { Rule } from "src/models/Rule";
import { SendgridUtil } from "src/utils/sendgrid";
import { fakePromise } from "../mockHelpers";

describe("RunAllRulesForOrganization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("correctly checks the ruleset for a folder and executes the correct rules", async () => {
    const sendgridSpy = jest
      .spyOn(SendgridUtil, "sendEmail")
      .mockImplementation(fakePromise);

    const organization = await OrganizationFactory.create();
    const user1 = await UserFactory.create({
      organizationId: organization._id,
    });
    const user2 = await UserFactory.create({
      organizationId: organization._id,
    });

    const folder1 = await FolderFactory.create({
      organizationId: organization._id,
    });
    const folder2 = await FolderFactory.create({
      organizationId: organization._id,
    });
    const folder3 = await FolderFactory.create();

    const rule1 = await RuleFactory.create({
      // triggers
      userId: user1._id,
      folderId: folder1._id,
      organizationId: folder1.organizationId,
      comparisonType: comparisonTypeEnum.CrossesAbove,
      comparisonValue: 2,
      lookbackTimeInMins: 5,
    });
    const rule2 = await RuleFactory.create({
      // does not trigger
      userId: user1._id,
      folderId: folder1._id,
      organizationId: folder1.organizationId,
      comparisonType: comparisonTypeEnum.CrossesAbove,
      comparisonValue: 2,
      lookbackTimeInMins: 1,
    });
    const rule3 = await RuleFactory.create({
      // triggers
      userId: user2._id,
      folderId: folder1._id,
      organizationId: folder1.organizationId,
      comparisonType: comparisonTypeEnum.CrossesAbove,
      comparisonValue: 2,
      lookbackTimeInMins: 5,
    });
    const rule4 = await RuleFactory.create({
      // triggers
      userId: user2._id,
      folderId: folder2._id,
      organizationId: folder2.organizationId,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 2,
      lookbackTimeInMins: 60,
    });
    const rule5 = await RuleFactory.create({
      // does not trigger
      folderId: folder3._id,
      organizationId: folder3.organizationId,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 2,
      lookbackTimeInMins: 60,
    });

    await LogFactory.create({
      folderId: folder1._id,
      createdAt: moment().subtract(1, "minute").toDate(),
    });
    await LogFactory.create({
      folderId: folder1._id,
      createdAt: moment().subtract(2, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder1._id,
      createdAt: moment().subtract(3, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder1._id,
      createdAt: moment().subtract(7, "minutes").toDate(),
    });

    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(3, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(67, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(68, "minutes").toDate(),
    });

    await LogFactory.create({
      folderId: folder3._id,
      createdAt: moment().subtract(3, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder3._id,
      createdAt: moment().subtract(67, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder3._id,
      createdAt: moment().subtract(68, "minutes").toDate(),
    });

    await RuleService.runAllRulesForOrganization(organization.id);

    const updatedRule1 = await Rule.findById(rule1._id);
    expect(updatedRule1?.lastTriggeredAt).toBeTruthy();
    expect(updatedRule1?.numberOfTimesTriggered).toBe(1);

    const updatedRule2 = await Rule.findById(rule2._id);
    expect(updatedRule2?.lastTriggeredAt).toBeUndefined();
    expect(updatedRule2?.numberOfTimesTriggered).toBe(0);

    const updatedRule3 = await Rule.findById(rule3._id);
    expect(updatedRule3?.lastTriggeredAt).toBeTruthy();
    expect(updatedRule3?.numberOfTimesTriggered).toBe(1);

    const updatedRule4 = await Rule.findById(rule4._id);
    expect(updatedRule4?.lastTriggeredAt).toBeTruthy();
    expect(updatedRule4?.numberOfTimesTriggered).toBe(1);

    const updatedRule5 = await Rule.findById(rule5._id);
    expect(updatedRule5?.lastTriggeredAt).toBeUndefined();
    expect(updatedRule5?.numberOfTimesTriggered).toBe(0);

    expect(sendgridSpy).toBeCalledTimes(3);
  });
});

describe("IsRuleTriggered", () => {
  it("correctly says a rule was triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesAbove,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(1, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(3, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(true);
  });
  it("correctly says a rule was not triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesAbove,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(1, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(3, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(false);
  });
  it("correctly says a rule was not triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesAbove,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(1, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(3, "minutes"),
    });
    await LogFactory.create({
      createdAt: moment().subtract(2, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(false);
  });
  it("correctly says a rule was triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesAbove,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(1, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(1, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(8, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(11, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(12, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(15, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(true);
  });
  it("correctly says a rule was triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(6, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(8, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(true);
  });
  it("correctly says a rule was triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(8, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(true);
  });
  it("correctly says a rule was not triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(3, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(false);
  });
  it("correctly says a rule was not triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      createdAt: moment().subtract(8, "minutes"),
    });
    await LogFactory.create({
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(false);
  });
  it("correctly says a rule was not triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(8, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(false);
  });
  it("correctly says a rule was not triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(8, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(13, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(12, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(12, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(false);
  });
  it("correctly says a rule was triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(4, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(8, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(8, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(13, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(12, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(12, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(12, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(true);
  });
  it("correctly says a rule was not triggered", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const user = await UserFactory.create({
      organizationId: organization._id,
    });
    const rule = await RuleFactory.create({
      userId: user._id,
      folderId: folder._id,
      comparisonType: comparisonTypeEnum.CrossesBelow,
      comparisonValue: 3,
      lookbackTimeInMins: 5,
      lastTriggeredAt: new Date(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(4, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(7, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(8, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(8, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(13, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(12, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(12, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(12, "minutes"),
    });
    const isTriggered = await RuleService.isRuleTriggered(rule);

    expect(isTriggered).toBe(false);
  });
});
